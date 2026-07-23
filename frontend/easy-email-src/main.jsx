import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdvancedType, BasicType, BlockManager, JsonToMjml } from "easy-email-core";
import { EmailEditor, EmailEditorProvider } from "easy-email-editor";
import { StandardLayout } from "easy-email-extensions";
import mjml2html from "mjml-browser";
import "easy-email-editor/lib/style.css";
import "easy-email-extensions/lib/style.css";
import "./styles.css";

const ADMIN_TOKEN_STORAGE_KEY = "tdc-crm-admin-token-session";
const API_BASE = String(window.CRM_API_BASE || "").replace(/\/$/, "");
const PURPOSES = ["marketing", "sales", "support", "transactional"];

function createTextBlock(content, attributes = {}, role = "") {
  const block = BlockManager.getBlockByType(AdvancedType.TEXT).create({
    data: { value: { content, chiwaRole: role } },
    attributes,
  });
  return block;
}

function createImageBlock(src, alt = "郵件圖片") {
  return BlockManager.getBlockByType(AdvancedType.IMAGE).create({
    attributes: {
      src,
      alt,
      align: "center",
      height: "auto",
      padding: "12px 32px",
    },
  });
}

function createButtonBlock(content = "了解 Chiwa AI", href = "https://chiwa.ai", backgroundColor = "#0f766e") {
  return BlockManager.getBlockByType(AdvancedType.BUTTON).create({
    data: { value: { content } },
    attributes: {
      href,
      "background-color": backgroundColor,
      color: "#ffffff",
      "border-radius": "6px",
      padding: "16px 32px",
      "inner-padding": "12px 28px",
    },
  });
}

function createArchiveHeaderBlock(backgroundColor = "#0f766e") {
  return createTextBlock(
    '<p style="text-align:center;margin:0;"><a href="{{web_archive_url}}" style="color:#ffffff;text-decoration:underline;">查看網頁版</a></p>',
    { "background-color": backgroundColor, color: "#ffffff", "font-size": "15px", padding: "18px 24px", align: "center" },
    "archive_header",
  );
}

function createComplianceFooterBlock(backgroundColor = "#f1f5f9") {
  return createTextBlock(
    '<p style="font-size:12px;color:#667085;margin:0;">您收到此郵件，是因為我們認為 Chiwa AI 的內容可能對您有幫助。<br><a href="{{consent_url}}">確認訂閱同意</a> · <a href="{{unsubscribe_url}}">退訂營銷郵件</a></p>',
    { "background-color": backgroundColor, color: "#667085", "font-size": "12px", padding: "24px 32px" },
    "compliance_footer",
  );
}

function createHighlightBlock(text = "這是一段高亮重點文字", backgroundColor = "#fff3a3") {
  return createTextBlock(
    `<p style="margin:0;"><span style="background-color:${backgroundColor};padding:2px 5px;border-radius:3px;">${escapeText(text)}</span></p>`,
    { color: "#111827", "font-size": "18px", padding: "12px 32px" },
  );
}

function createTextLinkBlock(text = "查看詳情", href = "https://chiwa.ai") {
  return createTextBlock(
    `<p style="margin:0;"><a href="${escapeAttribute(href)}" target="_blank" style="color:#0f766e;text-decoration:underline;font-weight:700;">${escapeText(text)}</a></p>`,
    { color: "#0f766e", "font-size": "16px", padding: "12px 32px" },
  );
}

function defaultContent() {
  const page = BlockManager.getBlockByType(BasicType.PAGE).create({});
  page.attributes = {
    ...(page.attributes || {}),
    "background-color": "#f5f7fb",
    width: "600px",
  };
  page.data.value = {
    ...(page.data.value || {}),
    "font-family": "Arial, Microsoft JhengHei, Microsoft YaHei, sans-serif",
    "font-size": "16px",
    "line-height": "1.6",
  };
  page.children = [
    createArchiveHeaderBlock(),
    createTextBlock(
      "<h1>Chiwa AI 最新方案</h1><p>您好 {{contactName}}，這封郵件可按 {{company}} 的行業、痛點與下一步行動進行個性化調整。</p>",
      { color: "#111827", "font-size": "18px", padding: "24px 32px 8px" },
    ),
    createButtonBlock(),
    createComplianceFooterBlock(),
  ];
  return page;
}

function defaultEmailData() {
  return {
    subject: "Chiwa AI 最新方案",
    subTitle: "可使用 {{company}}、{{contactName}} 等 CRM 變量",
    content: defaultContent(),
  };
}

function normalizeToken(token) {
  return String(token || "")
    .trim()
    .replace(/^ADMIN_API_TOKEN\s*=\s*/i, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "");
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  return doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim();
}

function ensureCompliance(html) {
  let next = String(html || "");
  if (!next.includes("{{web_archive_url}}")) {
    next = `<p style="text-align:center;font-size:12px;"><a href="{{web_archive_url}}">查看網頁版</a></p>${next}`;
  }
  if (!next.includes("{{unsubscribe_url}}")) {
    next += '<p style="font-size:12px;color:#667085;"><a href="{{unsubscribe_url}}">退訂營銷郵件</a></p>';
  }
  return next;
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function blockRole(block) {
  return block?.data?.value?.chiwaRole || "";
}

function App() {
  const [token, setToken] = useState(() => normalizeToken(sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)));
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("新圖文模板");
  const [purpose, setPurpose] = useState("marketing");
  const [subject, setSubject] = useState("Chiwa AI 最新方案");
  const [status, setStatus] = useState("等待載入");
  const [editorKey, setEditorKey] = useState(0);
  const [editorData, setEditorData] = useState(defaultEmailData);
  const [assetUrl, setAssetUrl] = useState("");
  const [assets, setAssets] = useState([]);
  const [headerBg, setHeaderBg] = useState("#0f766e");
  const [footerBg, setFooterBg] = useState("#f1f5f9");
  const [highlightText, setHighlightText] = useState("重點優惠 / 重要提醒");
  const [highlightBg, setHighlightBg] = useState("#fff3a3");
  const [linkText, setLinkText] = useState("查看詳情");
  const [linkUrl, setLinkUrl] = useState("https://chiwa.ai");
  const [buttonBg, setButtonBg] = useState("#0f766e");
  const valuesRef = useRef(editorData);

  const apiRequest = useCallback(async (path, options = {}) => {
    const authToken = normalizeToken(token);
    if (!authToken) throw new Error("請先輸入 Admin API Token");
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || "請求失敗");
    return payload;
  }, [token]);

  const loadTemplates = useCallback(async () => {
    setStatus("正在載入模板...");
    const payload = await apiRequest("/api/admin/templates");
    setTemplates(payload.templates || []);
    setStatus(`已載入 ${(payload.templates || []).length} 個模板`);
  }, [apiRequest]);

  const loadAssets = useCallback(async () => {
    const payload = await apiRequest("/api/admin/email-assets");
    setAssets(payload.assets || payload.data || []);
  }, [apiRequest]);

  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    loadTemplates().catch((error) => setStatus(error.message));
    loadAssets().catch((error) => setStatus(error.message));
  }, [token, loadTemplates, loadAssets]);

  const categories = useMemo(() => [
    {
      label: "常用內容",
      active: true,
      blocks: [
        { type: AdvancedType.TEXT },
        { type: AdvancedType.IMAGE, payload: { attributes: { padding: "12px 0" } } },
        { type: AdvancedType.BUTTON },
        { type: AdvancedType.DIVIDER },
        { type: AdvancedType.SPACER },
        { type: AdvancedType.HERO },
        { type: AdvancedType.WRAPPER },
      ],
    },
    {
      label: "排版",
      active: true,
      displayType: "column",
      blocks: [
        { title: "2 columns", payload: [["50%", "50%"], ["33%", "67%"], ["67%", "33%"]] },
        { title: "3 columns", payload: [["33.33%", "33.33%", "33.33%"]] },
      ],
    },
  ], []);

  function openTemplate(id) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) {
      setName("新圖文模板");
      setPurpose("marketing");
      setSubject("Chiwa AI 最新方案");
      setEditorData(defaultEmailData());
      setEditorKey((key) => key + 1);
      return;
    }
    setName(template.name || "");
    setPurpose(template.purpose || "marketing");
    setSubject(template.subjectTemplate || "");
    const easyEmail = template.variables?.easyEmail || safeJsonParse(template.variablesJson, {})?.easyEmail;
    if (easyEmail?.content) {
      setEditorData(easyEmail);
    } else {
      const data = defaultEmailData();
      data.subject = template.subjectTemplate || data.subject;
      data.subTitle = "由舊模板建立的新 Easy Email 版本";
      setEditorData(data);
      setStatus("舊模板已載入為新 Easy Email 草稿，保存後會生成新版圖文模板");
    }
    setEditorKey((key) => key + 1);
  }

  async function uploadAsset(event) {
    const files = event.target.files;
    if (!files?.length) return;
    const form = new FormData();
    [...files].forEach((file) => form.append("files", file));
    setStatus("正在上傳圖片...");
    const payload = await apiRequest("/api/admin/uploads/email-assets", { method: "POST", body: form });
    const uploaded = payload.assets || payload.data || [];
    const first = uploaded[0];
    setAssets((current) => [...uploaded, ...current.filter((asset) => !uploaded.some((item) => item.id === asset.id))]);
    setAssetUrl(first?.src || "");
    if (first?.src) {
      insertImageAsset(first.src, first.name || "郵件圖片");
      setStatus("圖片已上傳並插入到郵件畫布");
    } else {
      setStatus("圖片已上傳");
    }
    event.target.value = "";
  }

  function updateEditorContent(transform, message) {
    const current = valuesRef.current || editorData;
    const nextContent = transform(cloneJson(current.content || defaultContent()));
    const nextData = { ...current, subject, content: nextContent };
    valuesRef.current = nextData;
    setEditorData(nextData);
    setEditorKey((key) => key + 1);
    setStatus(message);
  }

  function insertBeforeFooter(content, block) {
    const children = Array.isArray(content.children) ? [...content.children] : [];
    const footerIndex = children.findIndex((item) => blockRole(item) === "compliance_footer");
    if (footerIndex >= 0) children.splice(footerIndex, 0, block);
    else children.push(block);
    return { ...content, children };
  }

  function insertImageAsset(src, alt = "郵件圖片") {
    if (!src) return setStatus("請先上傳或選擇圖片素材");
    updateEditorContent(
      (content) => insertBeforeFooter(content, createImageBlock(src, alt)),
      "已插入圖片素材",
    );
  }

  function addArchiveHeader() {
    updateEditorContent((content) => {
      const children = (content.children || []).filter((item) => blockRole(item) !== "archive_header");
      return { ...content, children: [createArchiveHeaderBlock(headerBg), ...children] };
    }, "已加入頁頭網頁版連結");
  }

  function removeArchiveHeader() {
    updateEditorContent((content) => ({
      ...content,
      children: (content.children || []).filter((item) => blockRole(item) !== "archive_header"),
    }), "已刪除頁頭網頁版連結");
  }

  function addComplianceFooter() {
    updateEditorContent((content) => {
      const children = (content.children || []).filter((item) => blockRole(item) !== "compliance_footer");
      return { ...content, children: [...children, createComplianceFooterBlock(footerBg)] };
    }, "已加入末尾合規組件");
  }

  function removeComplianceFooter() {
    updateEditorContent((content) => ({
      ...content,
      children: (content.children || []).filter((item) => blockRole(item) !== "compliance_footer"),
    }), "已刪除末尾合規組件；保存時仍會自動補退訂連結");
  }

  function updateRoleBackground(role, backgroundColor, fallbackFactory, message) {
    updateEditorContent((content) => {
      const children = [...(content.children || [])];
      const index = children.findIndex((item) => blockRole(item) === role);
      if (index >= 0) {
        children[index] = {
          ...children[index],
          attributes: {
            ...(children[index].attributes || {}),
            "background-color": backgroundColor,
          },
        };
      } else if (role === "archive_header") {
        children.unshift(fallbackFactory(backgroundColor));
      } else {
        children.push(fallbackFactory(backgroundColor));
      }
      return { ...content, children };
    }, message);
  }

  function applyHeaderBackground() {
    updateRoleBackground("archive_header", headerBg, createArchiveHeaderBlock, "已更新開頭背景色");
  }

  function applyFooterBackground() {
    updateRoleBackground("compliance_footer", footerBg, createComplianceFooterBlock, "已更新末尾背景色");
  }

  function insertHighlightText() {
    updateEditorContent(
      (content) => insertBeforeFooter(content, createHighlightBlock(highlightText, highlightBg)),
      "已插入高亮文本",
    );
  }

  function insertTextLink() {
    updateEditorContent(
      (content) => insertBeforeFooter(content, createTextLinkBlock(linkText, linkUrl)),
      "已插入文字超連結",
    );
  }

  function insertButtonLink() {
    updateEditorContent(
      (content) => insertBeforeFooter(content, createButtonBlock(linkText || "查看詳情", linkUrl || "https://chiwa.ai", buttonBg)),
      "已插入按鈕超連結",
    );
  }

  async function saveTemplate() {
    const values = { ...valuesRef.current, subject };
    const mjml = JsonToMjml({ data: values.content, mode: "production" });
    const result = mjml2html(mjml, { validationLevel: "soft" });
    if (result.errors?.length) {
      console.warn(result.errors);
    }
    const htmlTemplate = ensureCompliance(result.html);
    const payload = {
      name,
      purpose,
      subjectTemplate: subject,
      htmlTemplate,
      textTemplate: htmlToText(htmlTemplate),
      variables: {
        source: "easy-email",
        easyEmail: values,
        mjmlTemplate: mjml,
        compliance: {
          unsubscribeUrl: "{{unsubscribe_url}}",
          webArchiveUrl: "{{web_archive_url}}",
          consentUrl: "{{consent_url}}",
        },
      },
    };
    setStatus("正在保存模板...");
    const saved = await apiRequest(templateId ? `/api/admin/templates/${encodeURIComponent(templateId)}` : "/api/admin/templates", {
      method: templateId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    setTemplateId(saved.template?.id || templateId);
    await loadTemplates();
    setStatus("已保存，可在客戶發信與 Campaign 中使用");
  }

  function previewHtml() {
    const values = { ...valuesRef.current, subject };
    const mjml = JsonToMjml({ data: values.content, mode: "production" });
    const result = mjml2html(mjml, { validationLevel: "soft" });
    const win = window.open("about:blank", "_blank");
    if (!win) return setStatus("瀏覽器阻止了預覽視窗");
    win.document.write(ensureCompliance(result.html));
    win.document.close();
  }

  return (
    <main className="easy-shell">
      <header className="easy-header">
        <div>
          <p>CRM数字营销系统</p>
          <h1>Easy Email 圖文模板設計</h1>
        </div>
        <nav>
          <a href="/">返回 CRM</a>
          <button type="button" onClick={previewHtml}>預覽 HTML</button>
          <button type="button" className="primary" onClick={() => saveTemplate().catch((error) => setStatus(error.message))}>保存模板</button>
        </nav>
      </header>

      <section className="easy-meta">
        <label>Admin API Token<input value={token} onChange={(event) => setToken(normalizeToken(event.target.value))} placeholder="貼入後自動保存到本瀏覽器 session" /></label>
        <label>打開模板
          <select value={templateId} onChange={(event) => openTemplate(event.target.value)}>
            <option value="">新建 Easy Email 模板</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name || template.subjectTemplate}</option>)}
          </select>
        </label>
        <label>模板名稱<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>用途
          <select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
            {PURPOSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>主題<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label>上傳圖片素材<input type="file" accept="image/*" onChange={(event) => uploadAsset(event).catch((error) => setStatus(error.message))} /></label>
        <label>圖片 URL<input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="複製到 Image 組件的 src 欄位" /></label>
      </section>

      <section className="easy-helper">
        <span>{status}</span>
        <strong>合規占位符：</strong>
        <code>{'{{web_archive_url}}'}</code>
        <code>{'{{unsubscribe_url}}'}</code>
        <code>{'{{consent_url}}'}</code>
        <code>{'{{contactName}}'}</code>
        <code>{'{{company}}'}</code>
      </section>

      <section className="easy-controls">
        <div className="easy-control-group easy-component-tools">
          <strong>開頭 / 末尾</strong>
          <label>開頭背景 <input type="color" value={headerBg} onChange={(event) => setHeaderBg(event.target.value)} /></label>
          <button type="button" onClick={applyHeaderBackground}>套用開頭背景</button>
          <button type="button" onClick={addArchiveHeader}>加入開頭</button>
          <button type="button" onClick={removeArchiveHeader}>刪除開頭</button>
          <label>末尾背景 <input type="color" value={footerBg} onChange={(event) => setFooterBg(event.target.value)} /></label>
          <button type="button" onClick={applyFooterBackground}>套用末尾背景</button>
          <button type="button" onClick={addComplianceFooter}>加入末尾</button>
          <button type="button" onClick={removeComplianceFooter}>刪除末尾</button>
        </div>
        <div className="easy-control-group easy-component-tools">
          <strong>高亮 / 連結</strong>
          <input value={highlightText} onChange={(event) => setHighlightText(event.target.value)} placeholder="高亮文字" />
          <input type="color" value={highlightBg} onChange={(event) => setHighlightBg(event.target.value)} />
          <button type="button" onClick={insertHighlightText}>插入高亮文本</button>
          <input value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="連結文字 / 按鈕文字" />
          <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" />
          <input type="color" value={buttonBg} onChange={(event) => setButtonBg(event.target.value)} />
          <button type="button" onClick={insertTextLink}>插入文字連結</button>
          <button type="button" onClick={insertButtonLink}>插入按鈕連結</button>
        </div>
        <div className="easy-control-group easy-asset-strip">
          <strong>素材庫</strong>
          <button type="button" onClick={() => loadAssets().catch((error) => setStatus(error.message))}>刷新素材</button>
          {assets.slice(0, 8).map((asset) => (
            <button type="button" className="asset-chip" key={asset.id || asset.src} onClick={() => insertImageAsset(asset.src, asset.name)}>
              <img src={asset.src} alt={asset.name || "asset"} />
              <span>插入</span>
            </button>
          ))}
          {!assets.length && <em>暫無素材，先上傳圖片</em>}
        </div>
      </section>

      <section className="easy-editor">
        <EmailEditorProvider key={editorKey} data={editorData} height="calc(100vh - 330px)" autoComplete dashed={false}>
          {(formState) => {
            valuesRef.current = formState.values;
            return (
              <StandardLayout categories={categories} showSourceCode>
                <EmailEditor />
              </StandardLayout>
            );
          }}
        </EmailEditorProvider>
      </section>
    </main>
  );
}

createRoot(document.getElementById("easyEmailRoot")).render(<App />);
