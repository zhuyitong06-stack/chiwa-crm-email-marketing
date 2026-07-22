(function () {
  const STORAGE_KEY = "tdc-crm-web-state-v1";
  const ADMIN_TOKEN_STORAGE_KEY = "tdc-crm-admin-token-session";
  const EMAIL_DRAFT_STORAGE_KEY = "tdc-crm-email-drafts-v1";
  const DEFAULT_API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:3100" : "";
  const API_BASE = String(window.CRM_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const IMPORT_LOG_LIMIT = 8;
  const NO_FUNNEL_STAGE = "未进入营销漏斗";
  const COMPANY_ADDRESS_LABEL = "由後端 COMPANY_POSTAL_ADDRESS 自動加入";
  const SENDER_IDENTITIES = {
    support: {
      label: "Support",
      fromName: "Chiwa AI Customer Success",
      tone: "適合客服、回覆、問題跟進",
      signature: "Best regards,\nChiwa AI Customer Success\nhttps://chiwa.ai",
    },
    sales: {
      label: "Sales",
      fromName: "Chiwa AI Growth Team",
      tone: "適合銷售邀約、合作跟進",
      signature: "Best regards,\nChiwa AI Growth Team\nhttps://chiwa.ai",
    },
    marketing: {
      label: "Marketing",
      fromName: "Chiwa AI Insights",
      tone: "適合內容營銷、活動通知、長期培育",
      signature: "Best regards,\nChiwa AI Insights\nhttps://chiwa.ai",
    },
    transactional: {
      label: "Transactional",
      fromName: "Chiwa AI",
      tone: "適合確認、通知、系統類郵件",
      signature: "Best regards,\nChiwa AI\nhttps://chiwa.ai",
    },
  };

  const DEFAULT_FUNNEL = [
    { name: "邮件发送", step: 1, description: "已完成邮件触达" },
    { name: "客户点击链接", step: 2, description: "客户点击邮件链接" },
    { name: "确认使用", step: 3, description: "客户确认试用或使用" },
    { name: "后台订阅", step: 4, description: "完成后台订阅动作" },
    { name: "转化", step: 5, description: "进入正式转化阶段" },
  ];

  const FUNNEL_STAGE_NAMES = DEFAULT_FUNNEL.map((stage) => stage.name);
  const FUNNEL_SELECT_VALUES = [NO_FUNNEL_STAGE, ...FUNNEL_STAGE_NAMES];
  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tif", "tiff"];
  const OCR_LANGUAGES = "chi_tra+eng+chi_sim";
  const HK_COMPANY_PATTERN =
    /(有限公司|有限责任公司|集團|集团|公司|股份|實業|实业|企業|企业|貿易|贸易|國際|国际|控股|科技|藥業|药业|製品|制品|工程|設計|设计|發展|发展|餐飲|餐饮|食品|電器|電子|电子|limited|ltd\.?|company|co\.?|corporation|corp\.?|group|holdings?|enterprise|enterprises|international|industrial|industries|trading|technology|pharmaceutical|design|development|manufactur(?:ing|er|y)|factory|foods?)/i;
  const HK_TITLE_PATTERN =
    /(主席|副主席|董事(?:總經理|总经理)?|董事長|董事长|常務董事|执行董事|執行董事|創辦人|创办人|創始人|合夥人|合伙人|總裁|总裁|行政總裁|行政总裁|首席|總經理|总经理|副總經理|副总经理|經理|经理|副經理|主任|主管|負責人|负责人|顧問|顾问|代表|銷售|销售|營銷|营销|市場|市场|業務|业务|營運|营运|運營|运营|採購|采购|財務|财务|會計|会计|設計師|设计师|工程師|工程师|藥劑師|药剂师|創意|客戶|客户|客服|助理|秘書|秘书|president|chairman|chairwoman|founder|co-?founder|partner|owner|ceo|cfo|coo|cto|chief|director|managing director|general manager|manager|assistant manager|sales|marketing|business development|\\bbd\\b|operation|operations|account|executive|officer|consultant|representative|specialist|supervisor|designer|engineer|secretary|coordinator|administrator|head of|vice president|\\bvp\\b)/i;
  const CONTACT_NOISE_PATTERN =
    /(@|tel|telephone|mobile|phone|fax|email|e-mail|www\.|http|website|web|address|room|rm\.|floor|fl\.|building|centre|center|tower|street|road|avenue|industrial|電話|电话|手機|手机|手提|傳真|传真|電郵|邮箱|電子郵件|电子邮件|網址|网址|網站|网站|地址|香港|九龍|九龙|新界|\d{4,})/i;
  const HK_SURNAME_PATTERN = /^[陳陈李張张黃黄王梁劉刘楊杨吳吴伍何周鄭郑謝谢林馬马蘇苏蔡余葉叶郭盧卢羅罗方蕭萧曾許许唐馮冯鍾钟胡朱高潘廖杜袁程彭曹鄧邓薛姚魏施沈歐欧趙赵黎文區区關关莫石麥麦邱傅譚谭溫温]/;

  const SEGMENTS = [
    "A1 已有平台增長/OPM",
    "A2 從零入場/開店搭建",
    "B1 合規重類目入場",
    "B2 內容種草/社媒增長",
    "C1 先補KYC資料",
  ];

  const STATUSES = [
    "Ready for outreach",
    "KYC Required",
    "Missing email",
    "Contacted",
    "Follow-up",
    "Nurture",
    "Closed",
  ];

  const state = {
    leads: [],
    funnel: defaultFunnel(),
    selected: new Set(),
    backendSyncedAt: "",
    filters: {
      search: "",
      segment: "",
      funnel: "",
      status: "",
      priority: "",
    },
    importLog: [],
  };

  const mailState = {
    inbox: [],
    templates: [],
    campaigns: [],
    activeThreadId: "",
    activeThread: null,
    activeThreadMessages: [],
    activeCampaignId: "",
    campaignStep: 1,
  };

  const designerState = {
    editor: null,
    initialized: false,
    assets: [],
    selectedTextComponent: null,
    textBlocks: [],
    textBlockRefreshTimer: 0,
    focusMode: false,
  };

  const $ = (id) => document.getElementById(id);
  let adminTokenSyncTimer = 0;

  function defaultFunnel() {
    return DEFAULT_FUNNEL.map((stage) => ({ ...stage }));
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s*\|\|\s*/g, " / ")
      .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s+\/\s+\/\s+/g, " / ")
      .trim();
  }

  function htmlToText(value) {
    const element = document.createElement("div");
    element.innerHTML = String(value || "");
    return normalizeText(element.textContent || element.innerText || "");
  }

  function emailBodyText(message = "") {
    return normalizeText(message.textContent || "") || htmlToText(message.htmlContent || "");
  }

  function extractEmailAddress(value) {
    const raw = String(value || "")
      .trim()
      .replace(/^mailto:/i, "")
      .replace(/^['"]|['"]$/g, "");
    const bracketMatch = raw.match(/<([^<>]+)>/);
    const candidate = bracketMatch ? bracketMatch[1] : raw;
    const emailMatch = candidate.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/i) || raw.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/i);
    return emailMatch ? emailMatch[0].trim().toLowerCase() : raw;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function makeId(prefix = "WEB") {
    const next = state.leads.length + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  function fromSeed(record) {
    const importedFunnelStage = normalizeFunnelStage(
      valueBy(record, ["funnel_stage", "marketing_funnel_stage", "Funnel Stage", "Marketing Funnel Stage", "漏斗階段", "漏斗阶段"]),
    );
    const lead = {
      id: record.lead_id || makeId("SEED"),
      year: record.program_year || "",
      company: record.company || "",
      chineseName: record.chinese_name || "",
      industry: record.industry_group || inferIndustry(record),
      productCategory: record.product_category || "",
      brand: record.brand || "",
      contact: record.contact || "",
      title: record.title || "",
      email: record.email || "",
      phone: record.phone || "",
      website: record.website || "",
      platformStage: record.platform_stage || "",
      platforms: record.mainland_platforms || "",
      startTime: record.start_time || "",
      targetCustomer: record.target_customer || "",
      painPoints: record.pain_points || "",
      needs: record.needs || record.development_expectations || "",
      segment: record.service_segment || "",
      recommendedServices: record.recommended_services || "",
      dataCompleteness: record.data_completeness || "",
      dataScore: Number(record.data_score) || 3,
      stageScore: Number(record.stage_score) || 3,
      fitScore: Number(record.fit_score) || 3,
      urgencyScore: Number(record.urgency_score) || 3,
      leadScore: Number(record.lead_score) || 0,
      priority: record.priority || "",
      outreachStatus: record.outreach_status || "",
      campaign: record.campaign || "",
      emailSubject: record.email_subject || "",
      hook: record.personalization_hook || "",
      cta: record.cta_next_action || "",
      missingData: record.missing_data || "",
      source: record.source_file || "Seed data",
      sourceConfidence: record.source_confidence || "High",
      consultingExpectations: record.consulting_expectations || "",
      story: record.story_selling_points || "",
      owner: record.owner || "",
      lastContacted: record.last_contacted || "",
      nextFollowUp: record.next_follow_up || "",
      notes: record.notes || "",
      createdAt: record.created_at || todayIso(),
      updatedAt: record.updated_at || todayIso(),
      funnelStage: "",
      marketingTracked: false,
    };
    enrichLead(lead);
    return lead;
  }

  function inferIndustry(lead) {
    const text = [
      lead.company,
      lead.productCategory || lead.product_category,
      lead.brand,
      lead.story,
      lead.painPoints || lead.pain_points,
    ]
      .join(" ")
      .toLowerCase();
    const rules = [
      ["寵物用品", /寵物|宠物|pet|貓|猫|狗|bord|zooah|pplab/],
      ["運動/戶外", /運動|运动|體育|体育|戶外|户外|水上|游泳|sports|osprey|pacsafe/],
      ["玩具/教育玩具", /玩具|積木|积木|collectible|honeybear|ip|潮玩/],
      ["食品飲品", /食品|飲品|饮品|茶|麵|面|米|奶茶|蜂蜜/],
      ["酒類", /酒|wine|葡萄酒|紅酒/],
      ["醫藥/保健品", /保健|醫藥|医药|藥|药|營養|营养|健康食品|滋補|参茸/],
      ["母嬰/嬰童", /母嬰|母婴|嬰|婴|baby|尿布|紙尿褲|纸尿裤/],
      ["家居/家電科技", /家居|玻璃|按摩|吹風|闹钟|鬧鐘|houseware|環保產品/],
      ["美容/個人護理", /美容|護膚|护肤|防曬|sunscreen|hair|直髮|個人護理/],
    ];
    const match = rules.find(([, regex]) => regex.test(text));
    return match ? match[0] : "其他消費品";
  }

  function inferSegment(lead) {
    const text = [lead.productCategory, lead.brand, lead.painPoints, lead.needs, lead.consultingExpectations]
      .join(" ")
      .toLowerCase();
    if (lead.dataCompleteness === "Low") return "C1 先補KYC資料";
    if (/保健|醫藥|医药|藥|药|食品|酒|防曬|護膚|消毒|滋補|合規|政策|進口|进口|入口/.test(text)) {
      return "B1 合規重類目入場";
    }
    if (/kol|koc|內容|内容|種草|种草|直播|短視頻|短视频|小紅書|小红书|抖音|自媒體|自媒体/.test(text)) {
      return "B2 內容種草/社媒增長";
    }
    if (/未開始|尚未|準備|籌備|申請中|從零|入場|開店|开店/.test([lead.platformStage, lead.startTime].join(" "))) {
      return "A2 從零入場/開店搭建";
    }
    return "A1 已有平台增長/OPM";
  }

  function inferPlatformStage(lead) {
    const text = [lead.platforms, lead.platformStage, lead.startTime, lead.painPoints].join(" ");
    if (/資料不足/.test(text)) return "資料不足/待確認";
    if (/申請中|申请中/.test(text)) return "申請中/準備入場";
    if (/沒有|未開始|尚未|準備|籌備|打算/.test(text) && !lead.platforms) return "準備/尚未正式開始";
    if (lead.platforms && !/沒有/.test(lead.platforms)) return "已有平台/待優化";
    if (/20\d{2}|２０\d{2}|疫情/.test(text)) return "準備/尚未正式開始";
    return "待確認";
  }

  function inferDataCompleteness(lead) {
    const filled = [
      lead.company,
      lead.email,
      lead.productCategory,
      lead.brand,
      lead.targetCustomer,
      lead.painPoints,
      lead.needs,
    ].filter(Boolean).length;
    if (!lead.company || !lead.email || filled <= 3) return "Low";
    if (filled >= 6) return "High";
    return "Medium";
  }

  function normalizeFunnelStage(value) {
    const text = normalizeText(value);
    if (!text || text === NO_FUNNEL_STAGE) return "";
    if (FUNNEL_STAGE_NAMES.includes(text)) return text;
    if (/点击|點擊|click|link/.test(text)) return "客户点击链接";
    if (/确认使用|確認使用|试用|試用|使用|confirm|trial/.test(text)) return "确认使用";
    if (/后台订阅|後台訂閱|后台|後台|订阅|訂閱|subscribe|subscription/.test(text)) return "后台订阅";
    if (/转化|轉化|won|converted|conversion|成交/.test(text)) return "转化";
    if (/邮件发送|郵件發送|电邮发送|電郵發送|email sent|sent/.test(text)) return "邮件发送";
    return "";
  }

  function enrichLead(lead) {
    lead.company = normalizeText(lead.company);
    lead.email = normalizeText(lead.email);
    lead.industry = lead.industry || inferIndustry(lead);
    lead.platformStage = lead.platformStage || inferPlatformStage(lead);
    lead.dataCompleteness = lead.dataCompleteness || inferDataCompleteness(lead);
    lead.segment = lead.segment || inferSegment(lead);
    if (!STATUSES.includes(lead.outreachStatus)) {
      if (!lead.email) {
        lead.outreachStatus = "Missing email";
      } else if (lead.dataCompleteness === "Low" || lead.segment.startsWith("C1")) {
        lead.outreachStatus = "KYC Required";
      } else {
        lead.outreachStatus = "Ready for outreach";
      }
    }
    lead.funnelStage = normalizeFunnelStage(lead.funnelStage);
    lead.marketingTracked = Boolean(lead.marketingTracked && lead.funnelStage);
    lead.dataScore = lead.dataScore || ({ High: 5, Medium: 3, Low: 1 }[lead.dataCompleteness] || 3);
    lead.stageScore = lead.stageScore || (lead.platformStage === "已有平台/待優化" ? 5 : 3);
    lead.fitScore = lead.fitScore || (lead.segment.startsWith("C1") ? 2 : 5);
    lead.urgencyScore =
      lead.urgencyScore || (/流量|銷售|销售|競爭|竞争|成本|roi|合規|政策|信任/.test(lead.painPoints) ? 5 : 3);
    lead.leadScore = Math.round(
      (lead.dataScore * 0.25 + lead.stageScore * 0.3 + lead.fitScore * 0.25 + lead.urgencyScore * 0.2) * 20,
    );
    lead.priority = lead.priority || (lead.leadScore >= 90 ? "P1" : lead.leadScore >= 70 ? "P2" : "P3");
    lead.updatedAt = todayIso();
    return lead;
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leads: state.leads,
        importLog: state.importLog.slice(0, IMPORT_LOG_LIMIT),
        backendSyncedAt: state.backendSyncedAt,
      }),
    );
  }

  function loadState() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        state.leads = (parsed.leads || []).map((lead) => {
          const migrated = { ...lead };
          if (!migrated.marketingTracked) migrated.funnelStage = "";
          return enrichLead(migrated);
        });
        state.funnel = defaultFunnel();
        state.importLog = parsed.importLog || [];
        state.backendSyncedAt = parsed.backendSyncedAt || "";
        saveState();
        return;
      } catch (error) {
        console.warn(error);
      }
    }
    state.leads = (window.TDC_CRM_SEED || []).map(fromSeed);
    state.funnel = defaultFunnel();
    saveState();
  }

  function updateDataSourceBadge(status = "") {
    const badge = $("dataSourceBadge");
    if (!badge) return;
    if (status) {
      badge.textContent = status;
      badge.className = "data-source-badge syncing";
      return;
    }
    if (state.backendSyncedAt) {
      badge.textContent = `後端已同步 ${state.backendSyncedAt}`;
      badge.className = "data-source-badge synced";
      return;
    }
    const tokenReady = Boolean(adminToken());
    badge.textContent = tokenReady ? "可同步後端" : "本地資料";
    badge.className = `data-source-badge ${tokenReady ? "ready" : ""}`;
  }

  function getFilteredLeads() {
    const query = state.filters.search.toLowerCase();
    return state.leads.filter((lead) => {
      const haystack = [
        lead.company,
        lead.chineseName,
        lead.email,
        lead.brand,
        lead.targetCustomer,
        lead.painPoints,
        lead.needs,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (!state.filters.segment || lead.segment === state.filters.segment) &&
        (!state.filters.funnel ||
          (state.filters.funnel === NO_FUNNEL_STAGE ? !lead.funnelStage : lead.funnelStage === state.filters.funnel)) &&
        (!state.filters.status || lead.outreachStatus === state.filters.status) &&
        (!state.filters.priority || lead.priority === state.filters.priority)
      );
    });
  }

  function countBy(items, getter) {
    return items.reduce((acc, item) => {
      const key = getter(item) || "未分類";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function renderOptions(select, values, includeAll = true) {
    const current = select.value;
    select.innerHTML = "";
    if (includeAll) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "全部";
      select.appendChild(option);
    }
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = values.includes(current) ? current : "";
  }

  function optionsMarkup(values, current) {
    return values
      .map((value) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`)
      .join("");
  }

  function funnelIndex(stageName) {
    const normalized = normalizeFunnelStage(stageName);
    return FUNNEL_STAGE_NAMES.indexOf(normalized);
  }

  function getFunnelStats() {
    const total = state.leads.length;
    const trackedLeads = state.leads.filter((lead) => lead.marketingTracked && normalizeFunnelStage(lead.funnelStage));
    const exact = Object.fromEntries(FUNNEL_STAGE_NAMES.map((name) => [name, 0]));
    trackedLeads.forEach((lead) => {
      const stage = normalizeFunnelStage(lead.funnelStage);
      lead.funnelStage = stage;
      exact[stage] += 1;
    });
    const cumulative = Object.fromEntries(
      DEFAULT_FUNNEL.map((stage, index) => [
        stage.name,
        trackedLeads.filter((lead) => funnelIndex(lead.funnelStage) >= index).length,
      ]),
    );
    const converted = cumulative["转化"] || 0;
    const conversionRate = total ? Math.round((converted / total) * 100) : 0;
    return { total, tracked: trackedLeads.length, exact, cumulative, converted, conversionRate };
  }

  function renderControls() {
    renderOptions($("segmentFilter"), SEGMENTS);
    renderOptions($("funnelFilter"), FUNNEL_SELECT_VALUES);
    renderOptions($("bulkFunnel"), FUNNEL_SELECT_VALUES);
    $("bulkFunnel").firstElementChild.textContent = "更新漏斗";
    renderOptions($("statusFilter"), STATUSES);
    renderOptions($("bulkStatus"), STATUSES);
    $("bulkStatus").firstElementChild.textContent = "更新觸達狀態";
    renderOptions($("segmentField"), SEGMENTS, false);
    renderOptions($("funnelField"), FUNNEL_SELECT_VALUES, false);
    renderOptions($("statusField"), STATUSES, false);
  }

  function renderMetrics() {
    const stats = getFunnelStats();
    $("metricTotal").textContent = stats.total;
    $("metricEmailSent").textContent = stats.cumulative["邮件发送"] || 0;
    $("metricClicked").textContent = stats.cumulative["客户点击链接"] || 0;
    $("metricConverted").textContent = stats.converted;
    $("metricConversion").textContent = `${stats.conversionRate}%`;
    $("funnelOverallLabel").textContent =
      stats.tracked > 0 ? `${stats.converted} / ${stats.total} 已转化` : "等待邮件发送后开始统计";
  }

  function renderFunnelConfig() {
    const stats = getFunnelStats();
    $("funnelConfig").innerHTML = DEFAULT_FUNNEL
      .map(
        (stage) => `
          <div class="fixed-stage-row">
            <span>阶段 ${stage.step}</span>
            <strong>${escapeHtml(stage.name)}</strong>
            <small>${escapeHtml(stage.description)}${stats.tracked > 0 ? ` · 累计 ${stats.cumulative[stage.name] || 0}` : ""}</small>
          </div>
        `,
      )
      .join("");
  }

  function funnelVisualMarkup(mode = "") {
    const stats = getFunnelStats();
    if (stats.tracked === 0) {
      return `
        <div class="funnel-empty">
          <strong>尚未开始营销漏斗统计</strong>
          <span>当前只是客户资料池。发送邮件或由营销系统回传“邮件发送”阶段后，这里才会显示漏斗覆盖人数。</span>
        </div>
      `;
    }
    const total = Math.max(1, stats.total);
    return DEFAULT_FUNNEL.map((stage, index) => {
      const cumulative = stats.cumulative[stage.name] || 0;
      const exact = stats.exact[stage.name] || 0;
      const width = Math.max(30, Math.round((cumulative / total) * 100));
      return `
        <div class="funnel-slice ${mode}" style="--slice-width:${width}%; --slice-depth:${index}">
          <span>阶段 ${stage.step}</span>
          <strong>${escapeHtml(stage.name)}</strong>
          <em>累计 ${cumulative} · 当前 ${exact}</em>
        </div>
      `;
    }).join("");
  }

  function renderFunnelVisual(containerId, mode = "") {
    $(containerId).innerHTML = funnelVisualMarkup(mode);
  }

  function renderFunnelBoard() {
    const stats = getFunnelStats();
    $("funnelSubtitle").textContent =
      stats.tracked > 0 ? `已进入漏斗 ${stats.tracked} · 综合转化率 ${stats.conversionRate}%` : "等待邮件发送后开始统计";
    $("funnelBoard").innerHTML = `<div class="marketing-funnel dashboard">${funnelVisualMarkup("dashboard")}</div>`;
  }

  function renderBars(containerId, data, colorClass = "") {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, count]) => count));
    $(containerId).innerHTML =
      entries
        .map(([label, count]) => {
          const width = Math.max(4, Math.round((count / max) * 100));
          return `
            <div class="bar-row">
              <div class="bar-meta"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>
              <div class="bar-track"><span class="bar-fill ${colorClass}" style="width:${width}%"></span></div>
            </div>
          `;
        })
        .join("") || `<div class="followup-item"><span>暫無資料</span></div>`;
  }

  function renderFollowups() {
    const leads = [...state.leads]
      .filter((lead) => lead.nextFollowUp || lead.priority === "P1" || lead.outreachStatus === "KYC Required")
      .sort((a, b) => {
        const ad = a.nextFollowUp || "9999-99-99";
        const bd = b.nextFollowUp || "9999-99-99";
        if (ad !== bd) return ad.localeCompare(bd);
        return a.priority.localeCompare(b.priority);
      })
      .slice(0, 7);
    $("followupList").innerHTML =
      leads
        .map(
          (lead) => `
            <button class="followup-item" data-open="${escapeHtml(lead.id)}">
              <strong>${escapeHtml(lead.company)}</strong>
              <span>${escapeHtml(lead.nextFollowUp || "未設定下次跟進")} · ${escapeHtml(lead.priority)} · ${escapeHtml(lead.outreachStatus)}</span>
            </button>
          `,
        )
        .join("") || `<div class="followup-item"><span>暫無待跟進事項。</span></div>`;
  }

  function renderConversion() {
    const stats = getFunnelStats();
    renderFunnelVisual("analysisFunnelChart", "analysis");
    $("conversionSummary").innerHTML = `
      <div><span>总客户数</span><strong>${stats.total}</strong></div>
      <div><span>已进入漏斗</span><strong>${stats.tracked}</strong></div>
      <div><span>综合转化率</span><strong>${stats.conversionRate}%</strong></div>
    `;
    if (stats.tracked === 0) {
      $("conversionTable").innerHTML = `
        <div class="conversion-row">
          <strong>暂无营销漏斗数据</strong>
          <span>目前只完成客户资料导入。后续连接营销系统并发生邮件发送后，再按 5 个阶段统计点击、确认、订阅和转化。</span>
        </div>
      `;
      return;
    }
    $("conversionTable").innerHTML = DEFAULT_FUNNEL
      .map((stage, index) => {
        const cumulative = stats.cumulative[stage.name] || 0;
        const exact = stats.exact[stage.name] || 0;
        const previous = index === 0 ? stats.total : stats.cumulative[DEFAULT_FUNNEL[index - 1].name] || 0;
        const pass = previous ? Math.round((cumulative / previous) * 100) : 0;
        const share = stats.total ? Math.round((cumulative / stats.total) * 100) : 0;
        return `
          <div class="conversion-row">
            <strong>阶段 ${stage.step} · ${escapeHtml(stage.name)}：累计 ${cumulative}</strong>
            <span>当前停留 ${exact} · 总库覆盖 ${share}% · 阶段转化 ${pass}%</span>
          </div>
        `;
      })
      .join("");
  }

  function renderEmailAnalytics(analytics = null) {
    const summary = $("emailAnalyticsSummary");
    const events = $("emailAnalyticsEvents");
    if (!summary || !events) return;
    if (!analytics) {
      $("emailAnalyticsStatus").textContent = "尚未連接";
      summary.innerHTML = `<div><span>郵件行為</span><strong>--</strong></div>`;
      events.innerHTML = `<div class="conversion-row"><strong>等待郵件事件</strong><span>普通郵件和 Campaign 的送達、打開、點擊、回覆、退訂會在這裡匯總。</span></div>`;
      return;
    }
    const totals = analytics.totals || {};
    const sent = Number(totals.sentCount) || 0;
    const rate = (count) => `${sent ? Math.round((Number(count || 0) / sent) * 100) : 0}%`;
    $("emailAnalyticsStatus").textContent = `已追蹤 ${sent} 封發出郵件`;
    summary.innerHTML = [
      ["已發送", totals.sentCount],
      ["送達率", rate(totals.deliveredCount)],
      ["打開率", rate(totals.openedCount)],
      ["點擊率", rate(totals.clickedCount)],
      ["回覆數", totals.replyCount],
      ["退訂數", totals.unsubscribedCount],
    ]
      .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>`)
      .join("");
    events.innerHTML =
      (analytics.recentEvents || [])
        .slice(0, 12)
        .map(
          (event) => `
            <div class="conversion-row">
              <strong>${escapeHtml(event.eventType || "email.event")} · ${escapeHtml(event.contactCompany || event.contactEmail || "未知客戶")}</strong>
              <span>${escapeHtml(event.crmCustomerId || "")} · ${escapeHtml(event.subject || "")} · ${escapeHtml(event.createdAt || "")}</span>
            </div>
          `,
        )
        .join("") || `<div class="conversion-row"><strong>暫無郵件行為事件</strong><span>發送後由 Resend webhook 自動回寫。</span></div>`;
  }

  async function loadEmailAnalytics() {
    if (!adminToken()) {
      renderEmailAnalytics(null);
      return;
    }
    const payload = await apiRequest("/api/admin/analytics/email");
    renderEmailAnalytics(payload.analytics);
  }

  function renderTable() {
    const leads = getFilteredLeads();
    $("selectedCount").textContent = state.selected.size;
    $("crmTableBody").innerHTML = leads
      .map(
        (lead) => `
          <tr>
            <td><input type="checkbox" data-select="${escapeHtml(lead.id)}" ${state.selected.has(lead.id) ? "checked" : ""}></td>
            <td>${escapeHtml(lead.id)}</td>
            <td>
              <input class="table-input strong" data-edit="company" data-id="${escapeHtml(lead.id)}" value="${escapeHtml(lead.company)}" aria-label="公司名稱" />
              <input class="table-input muted-input" data-edit="brand" data-id="${escapeHtml(lead.id)}" value="${escapeHtml(lead.brand || "")}" placeholder="${escapeHtml(lead.industry || "品牌/品類")}" aria-label="品牌" />
            </td>
            <td><input class="table-input" data-edit="contact" data-id="${escapeHtml(lead.id)}" value="${escapeHtml(lead.contact || "")}" aria-label="聯絡人" /></td>
            <td><input class="table-input" type="text" inputmode="email" data-edit="email" data-id="${escapeHtml(lead.id)}" value="${escapeHtml(lead.email)}" aria-label="Email" /></td>
            <td><textarea class="table-textarea" data-edit="targetCustomer" data-id="${escapeHtml(lead.id)}" aria-label="目標客戶">${escapeHtml(lead.targetCustomer || "")}</textarea></td>
            <td>
              <label class="table-check">
                <input type="checkbox" data-edit="marketingOptIn" data-id="${escapeHtml(lead.id)}" ${lead.marketingOptIn ? "checked" : ""} />
                <span class="status-chip ${lead.unsubscribed ? "status-unsubscribed" : lead.marketingOptIn ? "status-delivered" : "status-unknown"}">
                  ${escapeHtml(lead.unsubscribed ? "已退訂" : lead.marketingOptIn ? "已同意" : "默認可發")}
                </span>
              </label>
            </td>
            <td class="row-actions">
              <button class="icon-only" data-copy-consent="${escapeHtml(lead.id)}" title="複製同意頁連結"><i data-lucide="link"></i></button>
              <button class="icon-only" data-copy-unsubscribe="${escapeHtml(lead.id)}" title="複製退訂連結"><i data-lucide="link-2-off"></i></button>
            </td>
            <td><select class="table-select" data-edit="funnelStage" data-id="${escapeHtml(lead.id)}">${optionsMarkup(FUNNEL_SELECT_VALUES, lead.funnelStage ? normalizeFunnelStage(lead.funnelStage) : NO_FUNNEL_STAGE)}</select></td>
            <td><select class="table-select" data-edit="outreachStatus" data-id="${escapeHtml(lead.id)}">${optionsMarkup(STATUSES, lead.outreachStatus)}</select></td>
            <td><select class="table-select priority-select ${escapeHtml(lead.priority.toLowerCase())}" data-edit="priority" data-id="${escapeHtml(lead.id)}">${optionsMarkup(["P1", "P2", "P3"], lead.priority)}</select></td>
            <td><input class="table-input date-input" type="date" data-edit="nextFollowUp" data-id="${escapeHtml(lead.id)}" value="${escapeHtml(lead.nextFollowUp || "")}" aria-label="下次跟進" /></td>
            <td class="row-actions">
              <button class="icon-only" data-email-lead="${escapeHtml(lead.id)}" title="發郵件"><i data-lucide="send"></i></button>
              <button class="icon-only" data-open="${escapeHtml(lead.id)}" title="打開詳情"><i data-lucide="panel-right-open"></i></button>
              <button class="icon-only danger" data-delete-lead="${escapeHtml(lead.id)}" title="刪除客戶"><i data-lucide="trash-2"></i></button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderImportLog() {
    $("importLog").innerHTML =
      state.importLog.length === 0
        ? "等待上傳資料。"
        : state.importLog.map((item) => `<div>${escapeHtml(item)}</div>`).join("");
  }

  function renderAll() {
    renderControls();
    renderMetrics();
    renderFunnelConfig();
    renderFunnelVisual("topFunnelChart", "compact");
    renderFunnelBoard();
    renderBars("segmentBars", countBy(state.leads, (lead) => lead.segment), "teal");
    renderBars("industryBars", countBy(state.leads, (lead) => lead.industry));
    renderBars("qualityBars", countBy(state.leads, (lead) => lead.dataCompleteness), "amber");
    renderFollowups();
    renderConversion();
    renderTable();
    renderImportLog();
    updateDataSourceBadge();
    if (window.lucide) window.lucide.createIcons();
  }

  function setToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function adminTokenInputs() {
    return ["workspaceAdminTokenField", "adminTokenField"].map((id) => $(id)).filter(Boolean);
  }

  function normalizeAdminToken(value) {
    let raw = String(value || "")
      .normalize("NFKC")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .trim();
    raw = raw
      .replace(/^Bearer\s+/i, "")
      .replace(/^ADMIN_API_TOKEN\s*=\s*/i, "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (/^[\x21-\x7e]+$/.test(raw)) return raw;
    const candidates = raw.match(/[A-Za-z0-9._~+/=-]{16,}/g) || [];
    return candidates.sort((a, b) => b.length - a.length)[0] || "";
  }

  function assertHeaderSafeToken(token) {
    if (!/^[\x21-\x7e]+$/.test(token)) {
      throw new Error("Admin API Token 含有中文、空格或隱藏字符，請重新貼上純 token 字符。");
    }
  }

  function rememberAdminToken(value) {
    const token = normalizeAdminToken(value);
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
    adminTokenInputs().forEach((input) => {
      if (input.value !== token) input.value = token;
    });
  }

  function adminToken() {
    const token =
      adminTokenInputs()
        .map((input) => normalizeAdminToken(input.value))
        .find(Boolean) || normalizeAdminToken(sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "");
    if (token) rememberAdminToken(token);
    return token;
  }

  function wireAdminTokenInputs() {
    const cached = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
    if (cached) rememberAdminToken(cached);
    adminTokenInputs().forEach((input) => {
      input.addEventListener("input", (event) => {
        rememberAdminToken(event.target.value);
        scheduleBackendSyncFromToken();
      });
    });
  }

  async function apiRequest(path, options = {}) {
    const token = adminToken();
    if (!token) throw new Error("請先輸入 Admin API Token");
    assertHeaderSafeToken(token);

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
    } catch (error) {
      if (String(error.message || "").includes("ISO-8859-1")) {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        adminTokenInputs().forEach((input) => {
          input.value = "";
        });
        throw new Error("Admin API Token 格式被瀏覽器拒絕。請只貼入純 token，不要包含中文說明、引號、換行或空格。");
      }
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `API request failed: ${response.status}`);
    }
    return payload;
  }

  async function uploadEmailDesignerAssets(files = []) {
    const token = adminToken();
    if (!token) throw new Error("請先輸入 Admin API Token");
    assertHeaderSafeToken(token);
    const formData = new FormData();
    [...files].forEach((file) => formData.append("files", file));
    const response = await fetch(`${API_BASE}/api/admin/uploads/email-assets`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Upload failed: ${response.status}`);
    }
    return payload.assets || payload.data || [];
  }

  function formatAssetSize(bytes = 0) {
    const size = Number(bytes) || 0;
    if (!size) return "";
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function leadPayloadFromLead(lead) {
    return {
      id: lead.id,
      crmCustomerId: lead.id,
      company: lead.company || "",
      firstName: lead.contact || "",
      email: extractEmailAddress(lead.email),
      phone: lead.phone || "",
      source: "tdc-crm-frontend",
      lifecycleStage: lead.outreachStatus || "",
      marketingOptIn: Boolean(lead.marketingOptIn),
      marketingConsentSource: lead.marketingOptIn ? lead.marketingConsentSource || "crm-manual" : "",
      tags: [lead.segment, lead.priority].filter(Boolean),
    };
  }

  function leadPayloadFromDrawer() {
    return {
      ...leadPayloadFromLead({
        id: $("leadIdField").value,
        company: $("companyField").value,
        contact: $("contactField").value,
        email: $("emailField").value,
        phone: $("phoneField").value,
        outreachStatus: $("statusField").value,
        segment: $("segmentField").value,
        priority: $("priorityField").value,
      }),
      marketingOptIn: Boolean($("marketingOptInField")?.checked),
      marketingConsentSource: $("marketingOptInField")?.checked ? "crm-manual" : "",
    };
  }

  async function syncLeadToBackend(lead) {
    const payload = leadPayloadFromLead(lead);
    if (!payload.email) throw new Error("客戶缺少 Email，無法生成合規連結");

    await apiRequest("/api/admin/contacts/import", {
      method: "POST",
      body: JSON.stringify({ contacts: [payload] }),
    });
    const normalizedEmail = extractEmailAddress(payload.email);
    const contactsPayload = await apiRequest(`/api/admin/contacts?search=${encodeURIComponent(normalizedEmail)}`);
    const contact = (contactsPayload.contacts || []).find((item) => item.email.toLowerCase() === normalizedEmail.toLowerCase());
    if (!contact) throw new Error("後端未找到同步後的客戶記錄");
    return contact;
  }

  async function syncDrawerLeadToBackend() {
    const payload = leadPayloadFromDrawer();
    if (!payload.email) throw new Error("客戶缺少 Email，無法發送郵件");

    await apiRequest("/api/admin/contacts/import", {
      method: "POST",
      body: JSON.stringify({ contacts: [payload] }),
    });
    const normalizedEmail = extractEmailAddress(payload.email);
    const contactsPayload = await apiRequest(`/api/admin/contacts?search=${encodeURIComponent(normalizedEmail)}`);
    const contact = (contactsPayload.contacts || []).find((item) => item.email.toLowerCase() === normalizedEmail.toLowerCase());
    if (!contact) throw new Error("後端未找到同步後的客戶記錄");
    return contact;
  }

  function emailDrafts() {
    try {
      return JSON.parse(localStorage.getItem(EMAIL_DRAFT_STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeEmailDrafts(drafts) {
    localStorage.setItem(EMAIL_DRAFT_STORAGE_KEY, JSON.stringify(drafts || {}));
  }

  function defaultSignatureForPurpose(purpose) {
    return SENDER_IDENTITIES[purpose]?.signature || SENDER_IDENTITIES.support.signature;
  }

  function isDefaultSignature(value) {
    const normalized = String(value || "").trim();
    return Object.values(SENDER_IDENTITIES).some((identity) => identity.signature.trim() === normalized);
  }

  function setSignatureForPurpose({ force = false } = {}) {
    const field = $("emailSignatureField");
    if (!field) return;
    const purpose = $("emailPurposeField").value || "support";
    if (force || !field.value.trim() || isDefaultSignature(field.value)) {
      field.value = defaultSignatureForPurpose(purpose);
    }
  }

  function currentComposerBody() {
    return $("emailBodyField").value.trim();
  }

  function currentComposerTextContent() {
    const body = currentComposerBody();
    if ($("emailBodyField").dataset.htmlContent) return body;
    return [body, $("emailSignatureField").value.trim()].filter(Boolean).join("\n\n");
  }

  function textToHtmlParagraphs(value = "") {
    return String(value || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function currentComposerHtmlContent() {
    const templateHtml = $("emailBodyField").dataset.htmlContent || "";
    if (!templateHtml) return "";
    return templateHtml;
  }

  function renderCustomerSnapshot(lead = getLead($("leadIdField")?.value)) {
    const container = $("drawerCustomerSnapshot");
    if (!container || !lead) return;
    const consent = lead.unsubscribed ? "已退訂" : lead.marketingOptIn ? "已同意 Marketing" : "默認可營銷";
    container.innerHTML = `
      <div class="snapshot-grid">
        <div class="snapshot-row"><span>公司</span><strong>${escapeHtml(lead.company || "未填")}</strong></div>
        <div class="snapshot-row"><span>聯絡人</span><strong>${escapeHtml(lead.contact || "未填")}</strong></div>
        <div class="snapshot-row"><span>Email</span><strong>${escapeHtml(lead.email || "未填")}</strong></div>
        <div class="snapshot-row"><span>階段</span><strong>${escapeHtml(lead.funnelStage || NO_FUNNEL_STAGE)}</strong></div>
        <div class="snapshot-row"><span>同意</span><strong>${escapeHtml(consent)}</strong></div>
        <div class="snapshot-row"><span>痛點</span><strong>${escapeHtml(lead.painPoints || "未填")}</strong></div>
      </div>
    `;
  }

  function renderSenderIdentityPreview() {
    const container = $("senderIdentityPreview");
    if (!container) return;
    const purpose = $("emailPurposeField").value || "support";
    const identity = SENDER_IDENTITIES[purpose] || SENDER_IDENTITIES.support;
    container.innerHTML = `
      <strong>${escapeHtml(identity.fromName)}</strong>
      <span>${escapeHtml(identity.label)} · ${escapeHtml(identity.tone)}</span>
    `;
  }

  function templateVariablesForDrawer() {
    const lead = getLead($("leadIdField")?.value) || {};
    return {
      contactName: $("contactField")?.value.trim() || lead.contact || "客戶姓名",
      company: $("companyField")?.value.trim() || lead.company || "公司名稱",
      email: $("emailField")?.value.trim() || lead.email || "customer@example.com",
      industry: lead.industry || "行業",
      painPoint: $("painField")?.value.trim() || lead.painPoints || "主要痛點",
      nextAction: lead.nextFollowUp ? `下次跟進 ${lead.nextFollowUp}` : "下一步行動",
      consentUrl: lead.consentUrl || "發送前由後端生成",
      unsubscribeUrl: lead.unsubscribeUrl || "發送前由後端生成",
    };
  }

  function renderTemplateVariablePreview() {
    const container = $("templateVariablePreview");
    if (!container) return;
    const variables = templateVariablesForDrawer();
    container.innerHTML = `
      <div class="drawer-section-title">
        <h3>模板變量預覽</h3>
        <span>{{...}}</span>
      </div>
      <div class="variable-grid">
        <div class="variable-row"><span>客戶名</span><code>{{contactName}} = ${escapeHtml(variables.contactName)}</code></div>
        <div class="variable-row"><span>公司名</span><code>{{company}} = ${escapeHtml(variables.company)}</code></div>
        <div class="variable-row"><span>行業</span><code>${escapeHtml(variables.industry)}</code></div>
        <div class="variable-row"><span>痛點</span><code>${escapeHtml(variables.painPoint)}</code></div>
        <div class="variable-row"><span>下一步</span><code>${escapeHtml(variables.nextAction)}</code></div>
        <div class="variable-row"><span>同意頁</span><code>{{consentUrl}} = ${escapeHtml(variables.consentUrl)}</code></div>
        <div class="variable-row"><span>退訂</span><code>{{unsubscribeUrl}} = ${escapeHtml(variables.unsubscribeUrl)}</code></div>
      </div>
    `;
  }

  function renderMarketingCompliancePreview() {
    const container = $("marketingCompliancePreview");
    if (!container) return;
    const purpose = $("emailPurposeField").value || "support";
    const lead = getLead($("leadIdField")?.value) || {};
    const identity = SENDER_IDENTITIES[purpose] || SENDER_IDENTITIES.support;
    const isMarketing = purpose === "marketing";
    const isUnsubscribed = Boolean(lead.unsubscribed);
    const status = !isMarketing || !isUnsubscribed ? "ok" : "bad";
    const consentText = !isMarketing
      ? "非 Marketing 郵件不要求訂閱同意"
      : isUnsubscribed
        ? "客戶已退訂，不能發送 Marketing 郵件"
        : "默認可發送 Marketing；客戶退訂後會自動停止";
    container.className = `compliance-preview ${status}`;
    container.innerHTML = `
      <div class="drawer-section-title">
        <h3>Marketing 合規預覽</h3>
        <span>${escapeHtml(status === "ok" ? "可發送" : "需處理")}</span>
      </div>
      <div class="compliance-grid">
        <div class="compliance-row"><span>發信身份</span><strong>${escapeHtml(identity.fromName)}</strong></div>
        <div class="compliance-row"><span>同意狀態</span><strong>${escapeHtml(consentText)}</strong></div>
        <div class="compliance-row"><span>退訂鏈接</span><strong>${escapeHtml(isMarketing ? "後端將自動加入退訂鏈接" : "可在模板中使用 {{unsubscribeUrl}}")}</strong></div>
        <div class="compliance-row"><span>公司地址</span><strong>${escapeHtml(isMarketing ? COMPANY_ADDRESS_LABEL : "Marketing 郵件時自動加入")}</strong></div>
      </div>
    `;
  }

  function renderEmailComposerAssist() {
    const lead = getLead($("leadIdField")?.value);
    renderCustomerSnapshot(lead);
    renderSenderIdentityPreview();
    renderTemplateVariablePreview();
    renderMarketingCompliancePreview();
  }

  function currentDraftPayload() {
    return {
      purpose: $("emailPurposeField").value,
      templateId: $("drawerTemplateSelect").value,
      subject: $("emailSubjectField").value,
      body: $("emailBodyField").value,
      signature: $("emailSignatureField").value,
      threadId: $("emailThreadIdField").value,
      testEmail: $("testEmailField").value,
      updatedAt: new Date().toISOString(),
    };
  }

  function saveCurrentEmailDraft({ silent = false } = {}) {
    const leadId = $("leadIdField").value;
    if (!leadId) return;
    const drafts = emailDrafts();
    drafts[leadId] = currentDraftPayload();
    writeEmailDrafts(drafts);
    if (!silent) setToast("郵件草稿已保存");
  }

  function loadCurrentEmailDraft(leadId) {
    const draft = emailDrafts()[leadId];
    if (!draft) return false;
    $("emailPurposeField").value = draft.purpose || $("emailPurposeField").value || "support";
    $("drawerTemplateSelect").value = draft.templateId || "";
    $("emailSubjectField").value = draft.subject || $("emailSubjectField").value;
    $("emailBodyField").value = draft.body || "";
    $("emailSignatureField").value = draft.signature || defaultSignatureForPurpose($("emailPurposeField").value);
    $("emailThreadIdField").value = draft.threadId || "";
    $("testEmailField").value = draft.testEmail || "";
    $("sendEmailStatus").textContent = `已載入本地草稿，保存時間：${new Date(draft.updatedAt || Date.now()).toLocaleString()}`;
    renderEmailComposerAssist();
    return true;
  }

  function clearCurrentEmailDraft() {
    const leadId = $("leadIdField").value;
    if (!leadId) return;
    const drafts = emailDrafts();
    delete drafts[leadId];
    writeEmailDrafts(drafts);
    $("emailBodyField").value = "";
    $("emailThreadIdField").value = "";
    setSignatureForPurpose({ force: true });
    renderEmailComposerAssist();
    setToast("本地草稿已清除");
  }

  const EMAIL_STATUS_LABELS = {
    queued: "排隊中",
    sent: "已提交 Resend",
    delivered: "已送達",
    delivery_delayed: "送達延遲",
    failed: "發送失敗",
    opened: "已打開",
    clicked: "已點擊",
    bounced: "退信",
    complained: "投訴",
    unsubscribed: "已退訂",
    suppressed: "已抑制",
    received: "已收到",
  };

  function emailStatusLabel(status = "") {
    return EMAIL_STATUS_LABELS[status] || status || "未知";
  }

  function emailStatusClass(status = "") {
    return `status-${String(status || "unknown").replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
  }

  function emailMessageTime(message) {
    return message.receivedAt || message.sentAt || message.updatedAt || message.createdAt || "";
  }

  function renderEmailTimeline(messages = []) {
    const timeline = $("emailTimeline");
    if (!messages.length) {
      timeline.innerHTML = "";
      return;
    }
    timeline.innerHTML = messages
      .slice(0, 8)
      .map(
        (message) => {
          const isInbound = message.direction === "inbound";
          const body = normalizeText(message.textContent || message.htmlContent || "");
          const preview = isInbound ? body : body.slice(0, 240);
          const status = emailStatusLabel(message.status);
          return `
          <div class="email-message-item">
            <div class="message-heading">
              <strong>${escapeHtml(message.subject || "(no subject)")}</strong>
              ${isInbound ? `<button class="text-button" data-reply-thread="${escapeHtml(message.threadId)}" data-reply-subject="${escapeHtml(message.subject || "")}" data-reply-from="${escapeHtml(message.fromEmail || "")}">回复</button>` : ""}
            </div>
            <span>${escapeHtml(isInbound ? "收到" : "發出")} · <mark class="status-chip ${emailStatusClass(message.status)}">${escapeHtml(status)}</mark> · ${escapeHtml(emailMessageTime(message))}</span>
            ${preview ? `<p class="${isInbound ? "message-body" : ""}">${escapeHtml(preview)}</p>` : ""}
          </div>
        `;
        },
      )
      .join("");
  }

  async function refreshEmailHistory({ successMessage = "" } = {}) {
    try {
      $("sendEmailStatus").textContent = "正在載入後端郵件記錄...";
      const contact = await syncDrawerLeadToBackend();
      const payload = await apiRequest(`/api/admin/contacts/${encodeURIComponent(contact.id)}/emails`);
      renderEmailTimeline(payload.messages || []);
      $("sendEmailStatus").textContent = successMessage || `已載入 ${payload.messages.length} 封郵件記錄。`;
    } catch (error) {
      $("sendEmailStatus").textContent = error.message;
      setToast(error.message);
    }
  }

  async function sendDrawerEmail() {
    const subject = $("emailSubjectField").value.trim();
    const textContent = currentComposerTextContent();
    const purpose = $("emailPurposeField").value;
    const lead = getLead($("leadIdField").value);
    if (purpose === "marketing" && lead?.unsubscribed) {
      const message = "客戶已退訂 Marketing 郵件，不能繼續正式發送。";
      $("sendEmailStatus").textContent = message;
      setToast(message);
      return;
    }
    if (!subject || !currentComposerBody()) {
      setToast("請填寫郵件主題和正文");
      return;
    }

    try {
      $("sendEmailBtn").disabled = true;
      $("sendEmailStatus").textContent = "正在同步客戶並發送郵件...";
      const contact = await syncDrawerLeadToBackend();
      const threadId = $("emailThreadIdField").value.trim();
      const payload = await apiRequest(`/api/admin/contacts/${encodeURIComponent(contact.id)}/emails/send`, {
        method: "POST",
        body: JSON.stringify({ subject, textContent, htmlContent: currentComposerHtmlContent(), purpose, ...(threadId ? { threadId } : {}) }),
      });

      if (lead) {
        lead.outreachStatus = "Contacted";
        lead.funnelStage = "邮件发送";
        lead.marketingTracked = true;
        if (purpose === "marketing") {
          lead.marketingOptIn = true;
          lead.marketingConsentSource = lead.marketingConsentSource || "default-marketing-send";
        }
        lead.lastContacted = todayIso();
        lead.updatedAt = todayIso();
        enrichLead(lead);
        saveState();
        renderAll();
      }

      const resendId = payload.resend?.id || payload.message?.resendEmailId || "已記錄";
      const successMessage = `已提交 Resend，ID: ${resendId}。送達、打開、點擊、退信等狀態會由 webhook 回寫，可稍後重新載入記錄。`;
      $("emailBodyField").value = "";
      $("emailThreadIdField").value = "";
      clearCurrentEmailDraft();
      await refreshEmailHistory({ successMessage });
      setToast("郵件已發送");
    } catch (error) {
      $("sendEmailStatus").textContent = error.message;
      setToast(error.message);
    } finally {
      $("sendEmailBtn").disabled = false;
    }
  }

  async function sendTestEmail() {
    const subject = $("emailSubjectField").value.trim();
    const textContent = currentComposerTextContent();
    const purpose = $("emailPurposeField").value;
    const testRecipient = $("testEmailField").value.trim();
    if (!testRecipient) {
      setToast("請先填寫測試收件 Email");
      return;
    }
    if (!subject || !currentComposerBody()) {
      setToast("請填寫郵件主題和正文");
      return;
    }

    try {
      $("testSendBtn").disabled = true;
      $("sendEmailStatus").textContent = "正在發送測試郵件...";
      const contact = await syncDrawerLeadToBackend();
      const payload = await apiRequest(`/api/admin/contacts/${encodeURIComponent(contact.id)}/emails/send`, {
        method: "POST",
        body: JSON.stringify({
          subject: `[TEST] ${subject}`,
          textContent,
          htmlContent: currentComposerHtmlContent(),
          purpose,
          testRecipient,
          threadId: $("emailThreadIdField").value.trim() || undefined,
        }),
      });
      const resendId = payload.resend?.id || payload.message?.resendEmailId || "已記錄";
      $("sendEmailStatus").textContent = `測試郵件已提交 Resend，ID: ${resendId}。正式發送前請檢查收件箱、退訂頁與簽名。`;
      saveCurrentEmailDraft({ silent: true });
      await refreshEmailHistory({ successMessage: $("sendEmailStatus").textContent });
      setToast("測試郵件已發送");
    } catch (error) {
      $("sendEmailStatus").textContent = error.message;
      setToast(error.message);
    } finally {
      $("testSendBtn").disabled = false;
    }
  }

  function focusEmailComposer() {
    const panel = document.querySelector(".email-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("emailSubjectField").focus(), 120);
  }

  function prepareDrawerReply({ threadId = "", subject = "", fromEmail = "" } = {}) {
    $("emailThreadIdField").value = threadId;
    $("emailPurposeField").value = "support";
    setSignatureForPurpose({ force: true });
    if (fromEmail) $("emailRecipientField").value = fromEmail;
    const normalizedSubject = subject && /^re:/i.test(subject) ? subject : `Re: ${subject || "客戶郵件"}`;
    $("emailSubjectField").value = normalizedSubject;
    $("emailBodyField").value = "";
    $("sendEmailStatus").textContent = threadId ? "已進入回覆模式，將沿用同一郵件會話。" : "已準備回覆郵件。";
    renderEmailComposerAssist();
    focusEmailComposer();
  }

  function updateMarketingPurposeNotice() {
    setSignatureForPurpose();
    renderEmailComposerAssist();
    if ($("emailPurposeField").value !== "marketing") {
      $("sendEmailStatus").textContent = "可發送 Support / Sales / Transactional 郵件；Marketing 會額外檢查同意與退訂。";
      return;
    }
    if ($("marketingOptInField").checked) {
      $("sendEmailStatus").textContent = "Marketing 郵件將附帶退訂資訊並受退信/投訴/抑制狀態限制。";
      return;
    }
    $("sendEmailStatus").textContent = "Marketing 正式郵件需要客戶同意；版面檢查可先使用測試發送。";
  }

  function ensureLeadFromInboxMessage(message) {
    const email = extractEmailAddress(message.contactEmail || message.fromEmail || "");
    let lead = state.leads.find((item) => extractEmailAddress(item.email).toLowerCase() === email.toLowerCase());
    if (lead) {
      lead.outreachStatus = "Follow-up";
      lead.nextFollowUp = todayIso();
      lead.updatedAt = todayIso();
      enrichLead(lead);
      saveState();
      renderAll();
      return lead;
    }

    lead = enrichLead({
      id: message.crmCustomerId || message.contactId || makeId("INBOX"),
      company: message.contactCompany || message.fromEmail || "Inbound contact",
      contact: normalizeText(`${message.contactFirstName || ""} ${message.contactLastName || ""}`),
      email,
      source: "Backend inbox",
      outreachStatus: "Follow-up",
      createdAt: todayIso(),
      nextFollowUp: todayIso(),
    });
    state.leads.push(lead);
    saveState();
    renderAll();
    return lead;
  }

  function openDrawerForEmail(id) {
    const lead = getLead(id);
    if (!lead) return;
    openDrawer(id);
    $("emailPurposeField").value = lead.outreachStatus === "Ready for outreach" ? "sales" : "support";
    setSignatureForPurpose({ force: true });
    $("emailThreadIdField").value = "";
    renderEmailComposerAssist();
    focusEmailComposer();
    if (adminToken()) runAsync(refreshEmailHistory);
  }

  function renderInbox(messages = mailState.inbox) {
    const unreadTotal = messages.reduce((total, message) => total + (Number(message.unreadCount) > 0 || !message.readAt ? 1 : 0), 0);
    $("inboxCountLabel").textContent = `${messages.length} 封入站郵件 · ${unreadTotal} 未讀`;
    $("inboxList").innerHTML =
      messages
        .map((message) => {
          const sender = message.contactCompany || message.fromEmail || message.contactEmail || "Unknown";
          const preview = emailBodyText(message).slice(0, 180);
          const isUnread = Number(message.unreadCount) > 0 || !message.readAt;
          const threadStatus = message.threadStatus || "open";
          const assignedTo = message.assignedTo || "未指派";
          return `
            <article class="mail-item ${message.threadId === mailState.activeThreadId ? "active" : ""} ${isUnread ? "unread" : ""}">
              <button class="mail-main" data-open-thread="${escapeHtml(message.threadId)}">
                <strong>${escapeHtml(message.subject || "(no subject)")}</strong>
                <span class="mail-meta-row">
                  ${isUnread ? `<mark class="status-chip status-delivery_delayed">未讀 ${Number(message.unreadCount) || 1}</mark>` : `<mark class="status-chip status-delivered">已讀</mark>`}
                  <mark class="status-chip status-${escapeHtml(threadStatus)}">${escapeHtml(threadStatus)}</mark>
                  <span>${escapeHtml(sender)} · ${escapeHtml(assignedTo)} · ${escapeHtml(message.receivedAt || message.createdAt || "")}</span>
                </span>
                ${preview ? `<p>${escapeHtml(preview)}</p>` : ""}
              </button>
              <div class="mail-actions">
                <button class="icon-only" data-inbox-open-contact="${escapeHtml(message.id)}" title="打開客戶"><i data-lucide="user-round"></i></button>
                <button class="icon-only" data-inbox-reply="${escapeHtml(message.id)}" title="回复"><i data-lucide="reply"></i></button>
                <button class="icon-only" data-inbox-read="${escapeHtml(message.threadId)}" data-read-value="${isUnread ? "true" : "false"}" title="${isUnread ? "標記已讀" : "標記未讀"}"><i data-lucide="${isUnread ? "mail-open" : "mail"}"></i></button>
              </div>
            </article>
          `;
        })
        .join("") || `<div class="mail-empty">暫無入站郵件</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadInbox() {
    $("inboxCountLabel").textContent = "載入中...";
    const search = $("inboxSearchInput").value.trim();
    const params = new URLSearchParams({
      limit: "80",
      search,
      read: $("inboxReadFilter").value,
      status: $("inboxStatusFilter").value,
      assignedTo: $("inboxAssigneeFilter").value.trim(),
    });
    const payload = await apiRequest(`/api/admin/inbox?${params.toString()}`);
    mailState.inbox = payload.messages || [];
    renderInbox();
  }

  function renderInboxThread(messages = []) {
    $("inboxThreadControls").hidden = !mailState.activeThread;
    if (mailState.activeThread) {
      $("inboxThreadStatusField").value = mailState.activeThread.status || "open";
      $("inboxThreadAssigneeField").value = mailState.activeThread.assignedTo || "";
      renderInboxReplyTemplateOptions();
    }
    $("inboxThreadMessages").innerHTML =
      messages
        .map((message) => {
          const isInbound = message.direction === "inbound";
          const body = emailBodyText(message);
          return `
            <article class="thread-message ${isInbound ? "inbound" : "outbound"}">
              <strong>${escapeHtml(isInbound ? message.fromEmail : message.toEmail)}</strong>
              <span>${escapeHtml(isInbound ? "收到" : "發出")} · <mark class="status-chip ${emailStatusClass(message.status)}">${escapeHtml(emailStatusLabel(message.status))}</mark> · ${escapeHtml(emailMessageTime(message))}</span>
              ${body ? `<p class="message-body">${escapeHtml(body)}</p>` : `<p class="message-body muted-body">這封郵件暫無正文，請稍後重新整理。</p>`}
            </article>
          `;
        })
        .join("") || `<div class="mail-empty">未載入會話</div>`;
  }

  async function openInboxThread(threadId) {
    mailState.activeThreadId = threadId;
    renderInbox();
    const payload = await apiRequest(`/api/admin/threads/${encodeURIComponent(threadId)}/read`, {
      method: "POST",
      body: JSON.stringify({ read: true }),
    });
    mailState.activeThread = payload.thread || null;
    mailState.activeThreadMessages = payload.messages || [];
    $("inboxThreadLabel").textContent = payload.thread?.subject || "會話";
    renderInboxThread(mailState.activeThreadMessages);
    mailState.inbox = mailState.inbox.map((message) =>
      message.threadId === threadId ? { ...message, readAt: new Date().toISOString(), unreadCount: 0 } : message,
    );
    renderInbox();
  }

  async function saveActiveThreadMeta() {
    if (!mailState.activeThreadId) {
      setToast("請先選擇會話");
      return;
    }
    const payload = await apiRequest(`/api/admin/threads/${encodeURIComponent(mailState.activeThreadId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: $("inboxThreadStatusField").value,
        assignedTo: $("inboxThreadAssigneeField").value.trim(),
      }),
    });
    mailState.activeThread = payload.thread;
    mailState.inbox = mailState.inbox.map((message) =>
      message.threadId === mailState.activeThreadId
        ? { ...message, threadStatus: payload.thread.status, assignedTo: payload.thread.assignedTo }
        : message,
    );
    renderInbox();
    renderInboxThread(mailState.activeThreadMessages);
    setToast("會話已更新");
  }

  async function markInboxThreadRead(threadId, read) {
    const payload = await apiRequest(`/api/admin/threads/${encodeURIComponent(threadId)}/read`, {
      method: "POST",
      body: JSON.stringify({ read }),
    });
    if (mailState.activeThreadId === threadId) {
      mailState.activeThread = payload.thread || mailState.activeThread;
      mailState.activeThreadMessages = payload.messages || mailState.activeThreadMessages;
      renderInboxThread(mailState.activeThreadMessages);
    }
    await loadInbox();
    setToast(read ? "已標記已讀" : "已標記未讀");
  }

  function activeInboxMessage() {
    return mailState.inbox.find((message) => message.threadId === mailState.activeThreadId) || null;
  }

  function openActiveThreadContact() {
    const message = activeInboxMessage();
    if (!message) {
      setToast("請先選擇會話");
      return;
    }
    openInboxContact(message.id);
  }

  async function useInboxReplyTemplate() {
    const templateId = $("inboxReplyTemplateSelect").value;
    const message = activeInboxMessage();
    if (!templateId || !message) {
      setToast("請先選擇會話和回复模板");
      return;
    }
    await ensureTemplatesLoaded();
    const lead = ensureLeadFromInboxMessage(message);
    openDrawer(lead.id);
    prepareDrawerReply({
      threadId: message.threadId,
      subject: message.subject,
      fromEmail: message.fromEmail || message.contactEmail,
    });
    applyTemplateToDrawer(templateId);
    $("emailThreadIdField").value = message.threadId;
    setToast("回复模板已套用");
  }

  function replyToInboxMessage(messageId) {
    const message = mailState.inbox.find((item) => item.id === messageId);
    if (!message) return;
    const lead = ensureLeadFromInboxMessage(message);
    openDrawer(lead.id);
    prepareDrawerReply({
      threadId: message.threadId,
      subject: message.subject,
      fromEmail: message.fromEmail || message.contactEmail,
    });
  }

  function openInboxContact(messageId) {
    const message = mailState.inbox.find((item) => item.id === messageId);
    if (!message) return;
    const lead = ensureLeadFromInboxMessage(message);
    lead.outreachStatus = "Follow-up";
    lead.nextFollowUp = todayIso();
    lead.updatedAt = todayIso();
    saveState();
    renderAll();
    openDrawer(lead.id);
    refreshEmailHistory().catch((error) => setToast(error.message));
  }

  function designerStarterHtml() {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:16px 24px;background:#0f766e;color:#ffffff;font-size:14px;">
                  <a href="{{web_archive_url}}" style="color:#d9fff7;text-decoration:underline;">查看網頁版</a>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 28px 12px;">
                  <h1 style="margin:0;color:#111827;font-size:28px;line-height:1.25;">Chiwa AI 最新方案</h1>
                  <p style="color:#475467;font-size:16px;line-height:1.7;">您好 {{contactName}}，這封郵件可按 {{company}} 的行業、痛點與下一步行動進行個性化調整。</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 28px;">
                  <div style="border:1px dashed #b8c4d6;border-radius:8px;padding:28px;text-align:center;color:#64748b;">
                    拖拽圖片到這裡，或使用左側 Asset Manager 上傳圖片
                  </div>
                  <p style="color:#344054;font-size:15px;line-height:1.7;margin:24px 0 0;">請在這裡放入產品亮點、案例、優惠或活動內容。</p>
                  <p style="margin:24px 0 0;">
                    <a href="https://chiwa.ai" style="background:#0f766e;border-radius:6px;color:#ffffff;display:inline-block;padding:12px 18px;text-decoration:none;">了解 Chiwa AI</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  function ensureDesignerComplianceHtml(html = "") {
    return String(html || "");
  }

  function designerTemplateVariables() {
    return {
      contactName: "Sample Contact",
      contactname: "Sample Contact",
      contact_name: "Sample Contact",
      company: "Sample Company",
      email: "customer@example.com",
      consenturl: "https://crm.chiwa.ai/consent?token=preview",
      consent_url: "https://crm.chiwa.ai/consent?token=preview",
      unsubscribeurl: "https://crm.chiwa.ai/unsubscribe?token=preview",
      unsubscribe_url: "https://crm.chiwa.ai/unsubscribe?token=preview",
      webarchiveurl: "https://chiwa.ai",
      web_archive_url: "https://chiwa.ai",
    };
  }

  function renderDesignerSample(value = "") {
    const variables = designerTemplateVariables();
    return String(value || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
      const normalized = key.toLowerCase();
      return variables[normalized] ?? variables[normalized.replace(/[_-]/g, "")] ?? variables[key] ?? match;
    });
  }

  function exportDesignerHtml() {
    const editor = designerState.editor;
    if (!editor) return "";
    try {
      const inlined = editor.runCommand("gjs-get-inlined-html");
      if (inlined) return ensureDesignerComplianceHtml(inlined);
    } catch {
      // The newsletter command is unavailable in some GrapesJS builds; fall back to raw HTML and CSS.
    }
    const css = editor.getCss() || "";
    const html = editor.getHtml() || "";
    return ensureDesignerComplianceHtml(`${css ? `<style>${css}</style>` : ""}${html}`);
  }

  function addDesignerBlocks(editor) {
    const blocks = editor.BlockManager;
    blocks.add("chiwa-web-archive", {
      label: "網頁版鏈接",
      category: "Chiwa 合規",
      content: `<p style="font-size:12px;text-align:center;"><a href="{{web_archive_url}}">查看網頁版</a></p>`,
    });
    blocks.add("chiwa-unsubscribe", {
      label: "退訂鏈接",
      category: "Chiwa 合規",
      content: `<p style="font-size:12px;color:#667085;"><a href="{{unsubscribe_url}}">退訂營銷郵件</a></p>`,
    });
    blocks.add("chiwa-consent", {
      label: "同意頁鏈接",
      category: "Chiwa 合規",
      content: `<p style="font-size:12px;color:#667085;"><a href="{{consent_url}}">確認接收 Marketing 郵件</a></p>`,
    });
    blocks.add("chiwa-cta", {
      label: "Chiwa CTA",
      category: "Chiwa Marketing",
      content: `<p><a href="https://chiwa.ai" style="background:#0f766e;border-radius:6px;color:#ffffff;display:inline-block;padding:12px 18px;text-decoration:none;">了解 Chiwa AI</a></p>`,
    });
    blocks.add("postsage-cta", {
      label: "PostSage CTA",
      category: "Chiwa Marketing",
      content: `<p><a href="https://postsage.ai/r/KEz9YGV6yhJHJgzB" style="background:#eb6a3e;border-radius:6px;color:#ffffff;display:inline-block;padding:12px 18px;text-decoration:none;">了解 PostSage</a></p>`,
    });
    blocks.add("chiwa-signature", {
      label: "簡潔簽名",
      category: "Chiwa Marketing",
      content: `<div style="font-family:Arial,Helvetica,sans-serif;color:#344054;font-size:14px;line-height:1.6;margin-top:24px;">
        Best regards,<br>
        Chiwa AI Insights<br>
        <a href="https://chiwa.ai" style="color:#0f766e;text-decoration:underline;">https://chiwa.ai</a>
      </div>`,
    });
  }

  function renderDesignerAssetLibrary() {
    const container = $("designerAssetLibrary");
    if (!container) return;
    $("designerAssetStatus").textContent = designerState.assets.length ? `${designerState.assets.length} 個素材` : "暫無素材";
    container.innerHTML =
      designerState.assets
        .map(
          (asset) => `
            <article class="designer-asset-item">
              <img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.name || "Email asset")}" loading="lazy" />
              <strong title="${escapeHtml(asset.name || asset.id || "")}">${escapeHtml(asset.name || asset.id || "素材")}</strong>
              <span>${escapeHtml(formatAssetSize(asset.size))}${asset.updatedAt ? ` · ${escapeHtml(String(asset.updatedAt).slice(0, 10))}` : ""}</span>
              <div class="designer-asset-actions">
                <button type="button" class="icon-button secondary" data-insert-designer-asset="${escapeHtml(asset.id || asset.src)}">
                  <i data-lucide="plus"></i>
                  插入
                </button>
                ${
                  asset.id
                    ? `<button type="button" class="icon-only danger" data-delete-designer-asset="${escapeHtml(asset.id)}" title="刪除素材">
                        <i data-lucide="trash-2"></i>
                      </button>`
                    : ""
                }
              </div>
            </article>
          `,
        )
        .join("") || `<div class="mail-empty">素材庫還沒有圖片。請上傳 Banner、產品圖、案例圖或活動圖。</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function addAssetsToGrapesJs(assets = []) {
    if (!designerState.editor || !assets.length) return;
    const existing = new Set(designerState.editor.AssetManager.getAll().map((asset) => asset.get("src")));
    const next = assets
      .filter((asset) => asset?.src && !existing.has(asset.src))
      .map((asset) => ({ src: asset.src, name: asset.name || asset.id || asset.src, type: "image" }));
    if (next.length) designerState.editor.AssetManager.add(next);
  }

  function selectedDesignerComponent() {
    return designerState.editor?.getSelected?.() || null;
  }

  function designerComponentTag(component) {
    return String(component?.get?.("tagName") || component?.get?.("type") || "").toLowerCase();
  }

  function designerComponentChildren(component) {
    const children = component?.components?.();
    if (!children?.each) return [];
    const items = [];
    children.each((child) => items.push(child));
    return items;
  }

  function isDesignerTextTag(tagName) {
    return ["p", "span", "td", "th", "h1", "h2", "h3", "h4", "li", "a", "strong", "em"].includes(tagName);
  }

  function hasDesignerTextChild(component) {
    return designerComponentChildren(component).some((child) => {
      const childTag = designerComponentTag(child);
      return isDesignerTextTag(childTag) || hasDesignerTextChild(child);
    });
  }

  function isDesignerTextLikeComponent(component) {
    if (!component) return false;
    const tagName = designerComponentTag(component);
    const type = String(component.get?.("type") || "").toLowerCase();
    if (["text", "textnode"].includes(type)) return Boolean(plainTextFromDesignerComponent(component));
    if (!isDesignerTextTag(tagName)) return false;
    if (["td", "th"].includes(tagName) && hasDesignerTextChild(component)) return false;
    return Boolean(plainTextFromDesignerComponent(component));
  }

  function walkDesignerComponents(component, visitor) {
    if (!component) return;
    visitor(component);
    designerComponentChildren(component).forEach((child) => walkDesignerComponents(child, visitor));
  }

  function collectDesignerTextBlocks() {
    if (!designerState.editor) return [];
    const wrapper = designerState.editor.DomComponents.getWrapper();
    const seen = new Set();
    const blocks = [];
    walkDesignerComponents(wrapper, (component) => {
      if (!isDesignerTextLikeComponent(component)) return;
      const cid = component.cid || component.getId?.() || "";
      if (!cid || seen.has(cid)) return;
      seen.add(cid);
      const tagName = designerComponentTag(component) || "text";
      const preview = plainTextFromDesignerComponent(component);
      blocks.push({ cid, component, tagName, preview });
    });
    designerState.textBlocks = blocks;
    return blocks;
  }

  function renderDesignerTextBlockList() {
    const container = $("designerTextBlockList");
    if (!container) return;
    const blocks = designerState.textBlocks || [];
    const selectedCid = designerState.selectedTextComponent?.cid || "";
    container.innerHTML =
      blocks
        .map(
          (block, index) => `
            <button type="button" class="designer-text-block${block.cid === selectedCid ? " active" : ""}" data-designer-text-block="${escapeHtml(block.cid)}">
              <span>${index + 1}. ${escapeHtml(block.tagName.toUpperCase())}</span>
              <strong>${escapeHtml(block.preview.slice(0, 96) || "空文字區塊")}</strong>
            </button>
          `,
        )
        .join("") || `<div class="mail-empty">尚未找到可編輯文字塊。請先新增文字或打開模板。</div>`;
  }

  function refreshDesignerTextBlocks({ silent = false } = {}) {
    const blocks = collectDesignerTextBlocks();
    renderDesignerTextBlockList();
    if (!silent && $("designerTextStatus")) {
      $("designerTextStatus").textContent = blocks.length ? `已掃描 ${blocks.length} 個文字塊` : "尚未找到可編輯文字塊";
    }
    return blocks;
  }

  function scheduleDesignerTextBlockRefresh() {
    clearTimeout(designerState.textBlockRefreshTimer);
    designerState.textBlockRefreshTimer = window.setTimeout(() => refreshDesignerTextBlocks({ silent: true }), 180);
  }

  function findDesignerTextBlockComponent(cid) {
    if (!cid) return null;
    return (designerState.textBlocks || []).find((block) => block.cid === cid)?.component || collectDesignerTextBlocks().find((block) => block.cid === cid)?.component || null;
  }

  function selectDesignerTextBlock(cid) {
    const component = findDesignerTextBlockComponent(cid);
    if (!component || !designerState.editor) return;
    designerState.editor.select(component);
    updateDesignerTextPanel(component);
    renderDesignerTextBlockList();
    try {
      component.view?.el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    } catch {
      // Selection still works when the embedded canvas cannot expose scrollIntoView.
    }
  }

  function selectedDesignerTextComponent() {
    const component = selectedDesignerComponent();
    if (!component) return null;
    if (isDesignerTextLikeComponent(component)) return component;
    const children = [];
    walkDesignerComponents(component, (child) => {
      if (child !== component && isDesignerTextLikeComponent(child)) children.push(child);
    });
    return children[0] || null;
  }

  function plainTextFromDesignerComponent(component) {
    if (!component) return "";
    const content = component.get?.("content");
    if (content) return htmlToText(content);
    return htmlToText(component.toHTML?.() || "");
  }

  function stableParagraphHtml(text = "") {
    const paragraphs = String(text || "")
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    if (!paragraphs.length) return "<p><br></p>";
    return paragraphs
      .map((paragraph) => `<p style="margin:0 0 12px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function stableTextHtmlForComponent(component, text = "") {
    const normalizedText = String(text || "").replace(/\r\n/g, "\n").trim();
    const safeText = escapeHtml(normalizedText || " ").replace(/\n/g, "<br>");
    const tagName = designerComponentTag(component);
    if (["td", "th"].includes(tagName)) return stableParagraphHtml(normalizedText);
    return safeText;
  }

  function setDesignerComponentText(component, text = "") {
    if (!component) return;
    const type = String(component.get?.("type") || "").toLowerCase();
    const content = stableTextHtmlForComponent(component, text);
    if (["text", "textnode"].includes(type)) {
      component.set("content", content);
      return;
    }
    component.components(content);
  }

  function textStyleFromDesignerFields() {
    return {
      "font-family": $("designerTextFontField")?.value || "Arial, Helvetica, sans-serif",
      "font-size": $("designerTextSizeField")?.value || "16px",
      "line-height": $("designerTextLineHeightField")?.value || "1.7",
      color: $("designerTextColorField")?.value || "#344054",
    };
  }

  function updateDesignerTextPanel(component = selectedDesignerTextComponent()) {
    designerState.selectedTextComponent = component || null;
    if (!component) {
      $("designerTextStatus").textContent = "請先在下方畫布選中文字區塊";
      renderDesignerTextBlockList();
      return;
    }
    const style = component.getStyle?.() || {};
    if (style["font-family"]) $("designerTextFontField").value = style["font-family"];
    if (style["font-size"]) $("designerTextSizeField").value = style["font-size"];
    if (style["line-height"]) $("designerTextLineHeightField").value = style["line-height"];
    if (/^#[0-9a-f]{6}$/i.test(style.color || "")) $("designerTextColorField").value = style.color;
    $("designerTextContentField").value = plainTextFromDesignerComponent(component);
    const tagName = component.get?.("tagName") || component.get?.("type") || "區塊";
    $("designerTextStatus").textContent = `已選中：${tagName}`;
    renderDesignerTextBlockList();
  }

  function applyDesignerStableText({ normalizeOnly = false } = {}) {
    const component = designerState.selectedTextComponent || selectedDesignerTextComponent();
    if (!component) {
      setToast("請先在畫布中選中文字區塊");
      return;
    }
    const text = normalizeOnly ? plainTextFromDesignerComponent(component) : $("designerTextContentField").value;
    setDesignerComponentText(component, text);
    component.setStyle({
      ...(component.getStyle?.() || {}),
      ...textStyleFromDesignerFields(),
    });
    designerState.selectedTextComponent = component;
    updateDesignerTextPanel(component);
    refreshDesignerTextBlocks({ silent: true });
    refreshEmailDesignerLayout();
    setToast(normalizeOnly ? "已清理選中區塊樣式" : "文字已穩定套用");
  }

  function applyDesignerTextStyleAll({ normalizeTextContent = false } = {}) {
    const blocks = refreshDesignerTextBlocks({ silent: true });
    if (!blocks.length) {
      setToast("尚未找到可套用的文字塊");
      return;
    }
    const style = textStyleFromDesignerFields();
    blocks.forEach(({ component }) => {
      if (normalizeTextContent) setDesignerComponentText(component, plainTextFromDesignerComponent(component));
      component.setStyle({
        ...(component.getStyle?.() || {}),
        ...style,
      });
    });
    refreshDesignerTextBlocks({ silent: true });
    refreshEmailDesignerLayout();
    setToast(normalizeTextContent ? `已清理並套用 ${blocks.length} 個文字塊` : `已批量套用 ${blocks.length} 個文字塊`);
  }

  function toggleDesignerFocusMode() {
    const card = document.querySelector(".designer-editor-card");
    if (!card) return;
    designerState.focusMode = !designerState.focusMode;
    card.classList.toggle("focused", designerState.focusMode);
    document.body.classList.toggle("designer-focus-active", designerState.focusMode);
    const button = $("designerFocusEditorBtn");
    if (button) {
      button.innerHTML = designerState.focusMode ? `<i data-lucide="minimize-2"></i>退出專注` : `<i data-lucide="maximize-2"></i>專注編輯`;
      if (window.lucide) window.lucide.createIcons();
    }
    refreshEmailDesignerLayout();
  }

  async function loadDesignerAssets({ silent = false } = {}) {
    if (!silent) $("designerAssetStatus").textContent = "正在載入素材...";
    const payload = await apiRequest("/api/admin/email-assets");
    designerState.assets = payload.assets || payload.data || [];
    addAssetsToGrapesJs(designerState.assets);
    renderDesignerAssetLibrary();
    return designerState.assets;
  }

  async function uploadDesignerAssetFiles(files = []) {
    const uploadFiles = [...files].filter(Boolean);
    if (!uploadFiles.length) return;
    $("designerAssetStatus").textContent = "正在上傳素材...";
    const assets = await uploadEmailDesignerAssets(uploadFiles);
    designerState.assets = [...assets, ...designerState.assets.filter((asset) => !assets.some((next) => next.id === asset.id))];
    addAssetsToGrapesJs(assets);
    renderDesignerAssetLibrary();
    setToast(`已上傳 ${assets.length} 個素材`);
  }

  function insertDesignerAsset(assetId) {
    const asset = designerState.assets.find((item) => item.id === assetId || item.src === assetId);
    if (!asset?.src || !designerState.editor) return;
    designerState.editor.addComponents(`<img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.name || "Email image")}" style="max-width:100%;height:auto;display:block;">`);
    designerState.editor.select(null);
    $("designerStatus").textContent = `已插入素材：${asset.name || asset.id}`;
    refreshEmailDesignerLayout();
  }

  async function deleteDesignerAsset(assetId) {
    const asset = designerState.assets.find((item) => item.id === assetId);
    if (!asset?.id) return;
    if (!confirm(`確認刪除素材「${asset.name || asset.id}」？已發出的歷史郵件如引用此圖片，可能無法再顯示。`)) return;
    await apiRequest(`/api/admin/email-assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
    designerState.assets = designerState.assets.filter((item) => item.id !== asset.id);
    renderDesignerAssetLibrary();
    setToast("素材已刪除");
  }

  async function initializeEmailDesigner() {
    if (designerState.initialized) return designerState.editor;
    if (!window.grapesjs) {
      $("designerStatus").textContent = "GrapesJS 未載入";
      throw new Error("GrapesJS vendor files are missing");
    }
    const newsletterPreset = window["grapesjs-preset-newsletter"];
    designerState.editor = window.grapesjs.init({
      container: "#emailDesignerEditor",
      height: "100%",
      storageManager: false,
      fromElement: false,
      plugins: newsletterPreset ? [newsletterPreset] : [],
      canvas: {
        styles: [],
      },
      assetManager: {
        uploadName: "files",
        multiUpload: true,
        autoAdd: true,
        uploadFile: async (event) => {
          try {
            const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
            await uploadDesignerAssetFiles(files || []);
          } catch (error) {
            $("designerStatus").textContent = error.message;
            setToast(error.message);
          }
        },
      },
    });
    addDesignerBlocks(designerState.editor);
    designerState.editor.on("component:selected", () => updateDesignerTextPanel());
    designerState.editor.on("component:deselected", () => {
      designerState.selectedTextComponent = null;
      $("designerTextStatus").textContent = "請先在下方畫布選中文字區塊";
      renderDesignerTextBlockList();
    });
    designerState.editor.on("component:add component:remove component:update", scheduleDesignerTextBlockRefresh);
    designerState.editor.on("rte:enable", () => {
      $("designerTextStatus").textContent = "畫布內可快速微調；大量文字建議用上方穩定文字編輯";
    });
    designerState.editor.setComponents(designerStarterHtml());
    designerState.initialized = true;
    $("designerStatus").textContent = "設計器已就緒";
    loadDesignerAssets({ silent: true }).catch((error) => {
      $("designerAssetStatus").textContent = error.message;
    });
    refreshDesignerTextBlocks({ silent: true });
    refreshEmailDesignerLayout();
    return designerState.editor;
  }

  function refreshEmailDesignerLayout() {
    if (!designerState.editor) return;
    requestAnimationFrame(() => {
      try {
        designerState.editor.refresh();
      } catch {
        // GrapesJS refresh is best-effort; layout still works if this is unavailable.
      }
    });
  }

  function resetDesignerForm() {
    $("designerTemplateIdField").value = "";
    $("designerTemplateSelect").value = "";
    $("designerTemplateNameField").value = "";
    $("designerPurposeField").value = "marketing";
    $("designerSubjectField").value = "";
    if (designerState.editor) designerState.editor.setComponents(designerStarterHtml());
    $("designerStatus").textContent = "新圖文模板";
    refreshDesignerTextBlocks({ silent: true });
    refreshEmailDesignerLayout();
  }

  function renderDesignerTemplateOptions(selectedId = "") {
    const select = $("designerTemplateSelect");
    if (!select) return;
    const previous = selectedId || select.value;
    select.innerHTML =
      `<option value="">新建圖文模板</option>` +
      mailState.templates
        .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name || template.subjectTemplate || template.id)} · ${escapeHtml(template.purpose || "support")}</option>`)
        .join("");
    if (previous && mailState.templates.some((template) => template.id === previous)) select.value = previous;
  }

  async function openDesignerTemplate(templateId) {
    await initializeEmailDesigner();
    if (!templateId) {
      resetDesignerForm();
      return;
    }
    const template = mailState.templates.find((item) => item.id === templateId);
    if (!template) return;
    $("designerTemplateIdField").value = template.id;
    $("designerTemplateSelect").value = template.id;
    $("designerTemplateNameField").value = template.name || "";
    $("designerPurposeField").value = template.purpose || "marketing";
    $("designerSubjectField").value = template.subjectTemplate || "";
    const projectData = template.variables?.designerProject;
    if (projectData) {
      try {
        designerState.editor.loadProjectData(projectData);
      } catch {
        designerState.editor.setComponents(template.htmlTemplate || `<p>${escapeHtml(template.textTemplate || "")}</p>`);
      }
    } else {
      designerState.editor.setComponents(template.htmlTemplate || `<p>${escapeHtml(template.textTemplate || "")}</p>`);
    }
    $("designerStatus").textContent = `已打開：${template.name || template.id}`;
    refreshDesignerTextBlocks({ silent: true });
    refreshEmailDesignerLayout();
  }

  async function loadDesignerPage() {
    await ensureTemplatesLoaded();
    renderDesignerTemplateOptions();
    await initializeEmailDesigner();
    await loadDesignerAssets({ silent: true });
    refreshEmailDesignerLayout();
  }

  function insertDesignerToken(token) {
    if (!designerState.editor) return;
    designerState.editor.addComponents(`<span>${escapeHtml(token)}</span>`);
    $("designerStatus").textContent = `已插入 ${token}`;
    refreshDesignerTextBlocks({ silent: true });
  }

  function previewDesignerHtml() {
    const html = renderDesignerSample(exportDesignerHtml());
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      setToast("瀏覽器阻止了預覽視窗");
      return;
    }
    preview.document.write(html);
    preview.document.close();
  }

  async function saveDesignerTemplate(event) {
    event.preventDefault();
    const name = $("designerTemplateNameField").value.trim();
    const subjectTemplate = $("designerSubjectField").value.trim();
    if (!name || !subjectTemplate) {
      setToast("請填寫模板名稱和主題");
      return;
    }
    await initializeEmailDesigner();
    const htmlTemplate = exportDesignerHtml();
    const templateId = $("designerTemplateIdField").value;
    const payload = {
      name,
      purpose: $("designerPurposeField").value,
      subjectTemplate,
      htmlTemplate,
      textTemplate: htmlToText(htmlTemplate),
      variables: {
        source: "grapesjs",
        compliance: {
          unsubscribeUrl: "{{unsubscribe_url}}",
          webArchiveUrl: "{{web_archive_url}}",
          consentUrl: "{{consent_url}}",
        },
        designerProject: designerState.editor.getProjectData(),
      },
    };
    const saved = await apiRequest(templateId ? `/api/admin/templates/${encodeURIComponent(templateId)}` : "/api/admin/templates", {
      method: templateId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    await loadTemplates();
    await openDesignerTemplate(saved.template?.id || templateId);
    setToast("圖文模板已保存，可在客戶發信和 Campaign 中使用");
  }

  function renderTemplates(templates = mailState.templates) {
    $("templateCountLabel").textContent = `${templates.length} 個模板`;
    $("templateList").innerHTML =
      templates
        .map(
          (template) => `
            <article class="template-item">
              <div>
                <strong>${escapeHtml(template.name)}</strong>
                <span>${escapeHtml(template.purpose)} · ${escapeHtml(template.subjectTemplate)}</span>
              </div>
              <div class="mail-actions">
                <button class="icon-only" data-use-template="${escapeHtml(template.id)}" title="套用到客戶郵件"><i data-lucide="copy-check"></i></button>
                <button class="icon-only" data-design-template="${escapeHtml(template.id)}" title="打開設計器"><i data-lucide="layout-template"></i></button>
                <button class="icon-only" data-edit-template="${escapeHtml(template.id)}" title="編輯模板"><i data-lucide="pencil"></i></button>
                <button class="icon-only danger" data-delete-template="${escapeHtml(template.id)}" title="刪除模板"><i data-lucide="trash-2"></i></button>
              </div>
            </article>
          `,
        )
        .join("") || `<div class="mail-empty">暫無模板</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadTemplates() {
    $("templateCountLabel").textContent = "載入中...";
    const payload = await apiRequest("/api/admin/templates");
    mailState.templates = payload.templates || [];
    renderTemplates();
    renderDrawerTemplateOptions();
    renderInboxReplyTemplateOptions();
    renderCampaignTemplateOptions();
    renderDesignerTemplateOptions();
  }

  async function ensureTemplatesLoaded() {
    if (mailState.templates.length) return;
    await loadTemplates();
  }

  function renderDrawerTemplateOptions(selectedId = "") {
    const select = $("drawerTemplateSelect");
    if (!select) return;
    const previous = selectedId || select.value;
    select.innerHTML =
      `<option value="">選擇模板</option>` +
      mailState.templates
        .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)} · ${escapeHtml(template.purpose)}</option>`)
        .join("");
    if (previous && mailState.templates.some((template) => template.id === previous)) {
      select.value = previous;
    }
  }

  function renderInboxReplyTemplateOptions(selectedId = "") {
    const select = $("inboxReplyTemplateSelect");
    if (!select) return;
    const previous = selectedId || select.value;
    const replyTemplates = mailState.templates.filter((template) => ["support", "sales"].includes(template.purpose || "support"));
    select.innerHTML =
      `<option value="">回复模板</option>` +
      replyTemplates
        .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name || template.subjectTemplate || template.id)}</option>`)
        .join("");
    if (previous && replyTemplates.some((template) => template.id === previous)) {
      select.value = previous;
    }
  }

  function renderCampaignTemplateOptions(selectedId = "") {
    const select = $("campaignTemplateSelect");
    if (!select) return;
    const previous = selectedId || select.value;
    const marketingTemplates = mailState.templates.filter((template) => (template.purpose || "marketing") === "marketing");
    select.innerHTML =
      `<option value="">選擇模板</option>` +
      marketingTemplates
        .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name || template.subjectTemplate || template.id)}</option>`)
        .join("");
    if (previous && marketingTemplates.some((template) => template.id === previous)) select.value = previous;
  }

  function resetTemplateForm() {
    $("templateIdField").value = "";
    $("templateNameField").value = "";
    $("templatePurposeField").value = "support";
    $("templateSubjectField").value = "";
    $("templateTextField").value = "";
    $("templateEditLabel").textContent = "新增模板";
  }

  function editTemplate(templateId) {
    const template = mailState.templates.find((item) => item.id === templateId);
    if (!template) return;
    $("templateIdField").value = template.id;
    $("templateNameField").value = template.name || "";
    $("templatePurposeField").value = template.purpose || "support";
    $("templateSubjectField").value = template.subjectTemplate || "";
    $("templateTextField").value = template.textTemplate || htmlToText(template.htmlTemplate || "");
    $("templateEditLabel").textContent = template.name || "模板編輯";
  }

  function applyTemplateToDrawer(templateId) {
    const template = mailState.templates.find((item) => item.id === templateId);
    if (!template) return;
    if (!$("detailDrawer").classList.contains("open")) {
      setToast("請先打開一位客戶");
      return;
    }
    $("emailPurposeField").value = template.purpose || "support";
    setSignatureForPurpose({ force: true });
    $("emailSubjectField").value = template.subjectTemplate || "";
    $("emailBodyField").value = template.textTemplate || htmlToText(template.htmlTemplate || "");
    $("emailBodyField").dataset.htmlContent = template.htmlTemplate || "";
    $("drawerTemplateSelect").value = template.id;
    updateMarketingPurposeNotice();
    focusEmailComposer();
  }

  async function applySelectedTemplateToDrawer() {
    await ensureTemplatesLoaded();
    const templateId = $("drawerTemplateSelect").value;
    if (!templateId) {
      setToast("請先選擇郵件模板");
      return;
    }
    applyTemplateToDrawer(templateId);
    setToast("模板已套用到客戶郵件");
  }

  async function saveTemplate(event) {
    event.preventDefault();
    const templateId = $("templateIdField").value;
    const payload = {
      name: $("templateNameField").value.trim(),
      purpose: $("templatePurposeField").value,
      subjectTemplate: $("templateSubjectField").value.trim(),
      textTemplate: $("templateTextField").value.trim(),
    };
    const path = templateId ? `/api/admin/templates/${encodeURIComponent(templateId)}` : "/api/admin/templates";
    const saved = await apiRequest(path, {
      method: templateId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    resetTemplateForm();
    await loadTemplates();
    renderDrawerTemplateOptions(saved.template?.id || "");
    setToast("模板已保存");
  }

  async function deleteTemplate(templateId) {
    const template = mailState.templates.find((item) => item.id === templateId);
    if (!template) return;
    if (!confirm(`確認刪除模板「${template.name || templateId}」？`)) return;
    await apiRequest(`/api/admin/templates/${encodeURIComponent(templateId)}`, { method: "DELETE" });
    if ($("templateIdField").value === templateId) resetTemplateForm();
    await loadTemplates();
    setToast("模板已刪除");
  }

  function renderCampaigns(campaigns = mailState.campaigns) {
    $("campaignCountLabel").textContent = `${campaigns.length} 個活動`;
    $("campaignList").innerHTML =
      campaigns
        .map(
          (campaign) => {
            const report = campaign.report || {};
            const sent = Number(report.sentCount ?? campaign.sentCount) || 0;
            const target = Number(report.targetCount ?? campaign.targetCount) || 0;
            const deliveredRate = sent ? Math.round(((Number(report.deliveredCount) || 0) / sent) * 100) : 0;
            const openedRate = sent ? Math.round(((Number(report.openedCount) || 0) / sent) * 100) : 0;
            return `
            <article class="campaign-item ${campaign.id === mailState.activeCampaignId ? "active" : ""}">
              <div>
                <strong>${escapeHtml(campaign.name)}</strong>
                <span>${escapeHtml(campaign.status)} · ${escapeHtml(campaign.subject)} · 目標 ${target} · 已發 ${sent} · 送達 ${deliveredRate}% · 打開 ${openedRate}%</span>
              </div>
              <div class="mail-actions">
                <button class="icon-only" data-select-campaign="${escapeHtml(campaign.id)}" title="打開流程"><i data-lucide="panel-right-open"></i></button>
                <button class="icon-only" data-report-campaign="${escapeHtml(campaign.id)}" title="查看報告"><i data-lucide="bar-chart-3"></i></button>
                <button class="icon-only danger" data-delete-campaign="${escapeHtml(campaign.id)}" title="刪除 Campaign">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </article>
          `;
          },
        )
        .join("") || `<div class="mail-empty">暫無活動</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function setCampaignStep(step) {
    mailState.campaignStep = Number(step) || 1;
    document.querySelectorAll("[data-campaign-step]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.campaignStep) === mailState.campaignStep);
    });
    document.querySelectorAll("[data-campaign-panel]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.campaignPanel) === mailState.campaignStep);
    });
    if (mailState.campaignStep === 3) renderCampaignPreview();
    if (mailState.campaignStep === 6) runAsync(loadCampaignReport);
  }

  function campaignPayloadFromForm() {
    const scheduledAt = $("campaignScheduledAtField").value;
    const leadIds = $("campaignLeadIdsField").value
      .split(/[,\s;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      name: $("campaignNameField").value.trim(),
      subject: $("campaignSubjectField").value.trim(),
      textContent: $("campaignTextField").value.trim(),
      htmlContent: $("campaignTextField").dataset.htmlContent || "",
      segmentFilter: {
        leadIds,
        priority: $("campaignPriorityField").value,
        savedView: $("campaignAudienceNameField").value.trim(),
      },
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      targetCount: Number($("campaignEstimatedCountField").value) || 0,
    };
  }

  function resetCampaignWizard() {
    mailState.activeCampaignId = "";
    $("campaignForm").reset();
    $("campaignIdField").value = "";
    $("campaignEstimatedCountField").value = "";
    $("campaignSampleJsonField").value = "";
    $("campaignTextField").dataset.htmlContent = "";
    $("campaignEstimateLabel").textContent = "尚未預估";
    $("campaignAudiencePreview").innerHTML = "";
    $("campaignPreviewPane").innerHTML = "";
    $("campaignReportGrid").innerHTML = "";
    $("campaignReportLabel").textContent = "未選擇 Campaign";
    $("campaignStatusLabel").textContent = "Draft";
    $("campaignActionStatus").textContent = "Campaign 尚未保存。";
    setCampaignStep(1);
    renderCampaigns();
  }

  function selectCampaign(campaignId) {
    const campaign = mailState.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    mailState.activeCampaignId = campaign.id;
    $("campaignIdField").value = campaign.id;
    $("campaignNameField").value = campaign.name || "";
    $("campaignSubjectField").value = campaign.subject || "";
    $("campaignTextField").value = campaign.textContent || "";
    $("campaignTextField").dataset.htmlContent = campaign.htmlContent || "";
    $("campaignLeadIdsField").value = (campaign.segmentFilter?.leadIds || []).join("\n");
    $("campaignPriorityField").value = campaign.segmentFilter?.priority || "";
    $("campaignAudienceNameField").value = campaign.segmentFilter?.savedView || "";
    $("campaignScheduledAtField").value = campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : "";
    $("campaignEstimatedCountField").value = campaign.targetCount || campaign.report?.targetCount || "";
    $("campaignEstimateLabel").textContent = campaign.targetCount ? `預估 ${campaign.targetCount} 位` : "尚未預估";
    $("campaignStatusLabel").textContent = campaign.status || "draft";
    $("campaignActionStatus").textContent = `已選擇 Campaign：${campaign.name}`;
    renderCampaigns();
    renderCampaignPreview();
  }

  async function loadCampaigns() {
    $("campaignCountLabel").textContent = "載入中...";
    await ensureTemplatesLoaded();
    const payload = await apiRequest("/api/admin/campaigns");
    mailState.campaigns = payload.campaigns || [];
    renderCampaigns();
    renderCampaignTemplateOptions();
  }

  async function saveCampaign(event) {
    event.preventDefault();
    const payload = campaignPayloadFromForm();
    if (!payload.name || !payload.subject || !payload.textContent) {
      setToast("請填寫活動名稱、主題和正文");
      return null;
    }
    const campaignId = $("campaignIdField").value;
    const saved = await apiRequest(campaignId ? `/api/admin/campaigns/${encodeURIComponent(campaignId)}` : "/api/admin/campaigns", {
      method: campaignId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    await loadCampaigns();
    selectCampaign(saved.campaign.id);
    $("campaignActionStatus").textContent = "Campaign 草稿已保存。";
    setToast("Campaign 已保存");
    return saved.campaign;
  }

  async function ensureCampaignSaved() {
    if ($("campaignIdField").value) return $("campaignIdField").value;
    const saved = await saveCampaign(new Event("submit"));
    return saved?.id || "";
  }

  async function estimateCampaignAudience() {
    const campaignId = await ensureCampaignSaved();
    if (!campaignId) return;
    const payload = await apiRequest(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/estimate`);
    $("campaignEstimatedCountField").value = payload.eligibleCount || 0;
    $("campaignSampleJsonField").value = JSON.stringify(payload.sample || []);
    $("campaignEstimateLabel").textContent = `預估 ${payload.eligibleCount} 位`;
    $("campaignSendSummary").textContent = `將面向 ${payload.eligibleCount} 位符合條件的客戶；已退訂、投訴、硬退信和抑制名單會自動排除。`;
    $("campaignAudiencePreview").innerHTML =
      (payload.sample || [])
        .map(
          (contact) =>
            `<div class="snapshot-row"><span>${escapeHtml(contact.crmCustomerId || contact.id || "Lead")}${contact.priority ? ` · ${escapeHtml(contact.priority)}` : ""}</span><strong>${escapeHtml(contact.company || contact.email)}</strong></div>`,
        )
        .join("") || `<div class="mail-empty">暫無符合條件客戶</div>`;
    setToast(`符合條件客戶：${payload.eligibleCount}`);
  }

  function applyCampaignTemplate() {
    const template = mailState.templates.find((item) => item.id === $("campaignTemplateSelect").value);
    if (!template) return;
    $("campaignSubjectField").value = template.subjectTemplate || "";
    $("campaignTextField").value = template.textTemplate || htmlToText(template.htmlTemplate || "");
    $("campaignTextField").dataset.htmlContent = template.htmlTemplate || "";
    renderCampaignPreview();
  }

  function renderCampaignPreview() {
    const sample = JSON.parse($("campaignSampleJsonField").value || "[]")[0] || {
      company: "Sample Company",
      email: "customer@example.com",
    };
    const variables = {
      contactname: "Sample Contact",
      company: sample.company || "Sample Company",
      email: sample.email || "customer@example.com",
      consenturl: "https://crm.chiwa.ai/consent?token=preview",
      unsubscribeurl: "https://crm.chiwa.ai/unsubscribe?token=preview",
      consent_url: "https://crm.chiwa.ai/consent?token=preview",
      unsubscribe_url: "https://crm.chiwa.ai/unsubscribe?token=preview",
      web_archive_url: "https://chiwa.ai",
    };
    const render = (value) =>
      String(value || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
        const normalized = key.toLowerCase();
        return variables[normalized] ?? variables[normalized.replace(/[_-]/g, "")] ?? match;
      });
    const htmlPreview = $("campaignTextField").dataset.htmlContent || "";
    $("campaignPreviewPane").innerHTML = `
      <div class="email-message-item">
        <strong>${escapeHtml(render($("campaignSubjectField").value || "Campaign subject"))}</strong>
        ${
          htmlPreview
            ? `<iframe title="Campaign HTML preview" class="campaign-html-preview" srcdoc="${escapeHtml(render(htmlPreview))}"></iframe>`
            : `<p class="message-body">${escapeHtml(render($("campaignTextField").value || "Campaign body preview"))}</p>`
        }
        <p class="muted-body">退訂鏈接和公司地址會在後端正式發送時自動加入。</p>
      </div>
    `;
  }

  async function testCampaignSend() {
    const campaignId = await ensureCampaignSaved();
    if (!campaignId) return;
    const testRecipient = $("campaignTestEmailField").value.trim();
    if (!testRecipient) {
      setToast("請先填寫測試收件 Email");
      return;
    }
    $("campaignActionStatus").textContent = "正在發送 Campaign 測試郵件...";
    const payload = await apiRequest(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/test`, {
      method: "POST",
      body: JSON.stringify({ testRecipient }),
    });
    $("campaignActionStatus").textContent = `測試郵件已提交 Resend，ID: ${payload.resend?.id || "已記錄"}`;
    setToast("Campaign 測試郵件已發送");
  }

  async function startCampaign() {
    const campaignId = await ensureCampaignSaved();
    if (!campaignId) return;
    const scheduledAt = $("campaignScheduledAtField").value;
    if (!confirm(scheduledAt ? "確認保存定時 Campaign？" : "確認立即發送 Campaign？")) return;
    $("campaignActionStatus").textContent = scheduledAt ? "正在保存定時 Campaign..." : "正在立即發送 Campaign...";
    const payload = await apiRequest(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/start`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "" }),
    });
    await loadCampaigns();
    selectCampaign(payload.campaign?.id || campaignId);
    $("campaignActionStatus").textContent = payload.queued
      ? `已定時，目標 ${payload.targetCount} 位。`
      : payload.limited
        ? `已發送 ${payload.sentCount} 位，剩餘客戶請再次點擊繼續分批發送；失敗 ${payload.failedCount} 位。`
        : `已發送 ${payload.sentCount} 位，失敗 ${payload.failedCount} 位。`;
    setCampaignStep(6);
  }

  async function loadCampaignReport() {
    const campaignId = $("campaignIdField").value;
    if (!campaignId) {
      $("campaignReportGrid").innerHTML = `<div class="mail-empty">請先保存或選擇 Campaign</div>`;
      return;
    }
    const payload = await apiRequest(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/report`);
    const report = payload.report || {};
    const sent = Number(report.sentCount) || 0;
    const rate = (count) => `${sent ? Math.round((Number(count || 0) / sent) * 100) : 0}%`;
    const items = [
      ["目标客户数", report.targetCount],
      ["已发送", report.sentCount],
      ["送达率", rate(report.deliveredCount)],
      ["打开率", rate(report.openedCount)],
      ["点击率", rate(report.clickedCount)],
      ["回复数", report.replyCount],
      ["退信数", report.bouncedCount],
      ["投诉数", report.complainedCount],
      ["退订数", report.unsubscribedCount],
    ];
    $("campaignReportLabel").textContent = report.campaign?.name || "Campaign 報告";
    $("campaignReportGrid").innerHTML = items
      .map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>`)
      .join("");
  }

  async function deleteCampaign(campaignId) {
    const campaign = mailState.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    if (!confirm(`確認刪除 Campaign「${campaign.name || campaignId}」？`)) return;
    await apiRequest(`/api/admin/campaigns/${encodeURIComponent(campaignId)}`, { method: "DELETE" });
    await loadCampaigns();
    $("campaignStatusLabel").textContent = "Draft";
    setToast("Campaign 已刪除");
  }

  function getLead(id) {
    return state.leads.find((lead) => lead.id === id);
  }

  function openDrawer(id) {
    const lead =
      getLead(id) ||
      enrichLead({
        id: makeId("MANUAL"),
        company: "",
        createdAt: todayIso(),
        nextFollowUp: addDays(7),
      });
    if (!getLead(lead.id)) state.leads.push(lead);
    $("leadIdField").value = lead.id;
    $("drawerTitle").textContent = lead.company || "新增客戶";
    $("drawerSubtitle").textContent = `${lead.id} · ${lead.updatedAt || todayIso()}`;
    $("companyField").value = lead.company || "";
    $("chineseNameField").value = lead.chineseName || "";
    $("contactField").value = lead.contact || "";
    $("emailField").value = lead.email || "";
    $("emailRecipientField").value = lead.email || "";
    $("phoneField").value = lead.phone || "";
    $("websiteField").value = lead.website || "";
    $("targetField").value = lead.targetCustomer || "";
    $("painField").value = lead.painPoints || "";
    $("needsField").value = lead.needs || "";
    $("segmentField").value = lead.segment || SEGMENTS[0];
    $("funnelField").value = lead.funnelStage ? normalizeFunnelStage(lead.funnelStage) : NO_FUNNEL_STAGE;
    $("statusField").value = lead.outreachStatus || STATUSES[0];
    $("priorityField").value = lead.priority || "P2";
    $("marketingOptInField").checked = Boolean(lead.marketingOptIn);
    $("ownerField").value = lead.owner || "";
    $("nextField").value = lead.nextFollowUp || "";
    $("notesField").value = lead.notes || "";
    $("emailThreadIdField").value = "";
    $("emailPurposeField").value = lead.outreachStatus === "Ready for outreach" ? "sales" : "support";
    $("emailSubjectField").value = lead.emailSubject || `跟進${lead.company || "客戶"}合作事宜`;
    $("emailBodyField").value = "";
    $("testEmailField").value = "";
    setSignatureForPurpose({ force: true });
    $("sendEmailStatus").textContent = "可輸入 Admin API Token 後發送郵件。";
    renderDrawerTemplateOptions();
    if (adminToken()) runAsync(ensureTemplatesLoaded);
    renderEmailTimeline([]);
    loadCurrentEmailDraft(lead.id);
    renderEmailComposerAssist();
    $("detailDrawer").classList.add("open");
    $("detailDrawer").setAttribute("aria-hidden", "false");
    saveState();
    renderAll();
  }

  function closeDrawer() {
    $("detailDrawer").classList.remove("open");
    $("detailDrawer").setAttribute("aria-hidden", "true");
  }

  function saveLeadFromForm(event) {
    event.preventDefault();
    const lead = getLead($("leadIdField").value);
    if (!lead) return;
    Object.assign(lead, {
      company: $("companyField").value,
      chineseName: $("chineseNameField").value,
      contact: $("contactField").value,
      email: $("emailField").value,
      phone: $("phoneField").value,
      website: $("websiteField").value,
      targetCustomer: $("targetField").value,
      painPoints: $("painField").value,
      needs: $("needsField").value,
      segment: $("segmentField").value,
      funnelStage: normalizeFunnelStage($("funnelField").value),
      marketingTracked: Boolean(normalizeFunnelStage($("funnelField").value)),
      marketingOptIn: Boolean($("marketingOptInField").checked),
      outreachStatus: $("statusField").value,
      priority: $("priorityField").value,
      owner: $("ownerField").value,
      nextFollowUp: $("nextField").value,
      notes: $("notesField").value,
      updatedAt: todayIso(),
    });
    enrichLead(lead);
    saveState();
    renderAll();
    setToast("已保存客戶資料");
    if (adminToken() && extractEmailAddress(lead.email)) {
      runAsync(() => syncBackendContacts({ silent: true }));
    }
  }

  function deleteCurrentLead() {
    const id = $("leadIdField").value;
    state.leads = state.leads.filter((lead) => lead.id !== id);
    state.selected.delete(id);
    saveState();
    closeDrawer();
    renderAll();
    setToast("已刪除客戶");
  }

  function deleteLeadById(id) {
    const lead = getLead(id);
    if (!lead) return;
    if (!confirm(`確認刪除「${lead.company || id}」？`)) return;
    state.leads = state.leads.filter((item) => item.id !== id);
    state.selected.delete(id);
    saveState();
    renderAll();
    setToast("已刪除客戶");
  }

  function updateLeadField(id, field, value) {
    const lead = getLead(id);
    if (!lead) return;
    if (field === "funnelStage") {
      lead.funnelStage = normalizeFunnelStage(value);
      lead.marketingTracked = Boolean(lead.funnelStage);
    } else if (field === "marketingOptIn") {
      lead.marketingOptIn = Boolean(value);
      lead.marketingConsentSource = lead.marketingOptIn ? "crm-manual" : "";
      if (lead.marketingOptIn) lead.unsubscribed = false;
    } else {
      lead[field] = value;
    }
    lead.updatedAt = todayIso();
    enrichLead(lead);
    saveState();
    renderAll();
    setToast("已保存表格修改");
  }

  function applyBulk() {
    if (state.selected.size === 0) {
      setToast("請先選擇客戶");
      return;
    }
    const bulkFunnelValue = $("bulkFunnel").value;
    const updates = {
      outreachStatus: $("bulkStatus").value,
      owner: $("bulkOwner").value,
    };
    state.leads.forEach((lead) => {
      if (!state.selected.has(lead.id)) return;
      Object.entries(updates).forEach(([key, value]) => {
        if (value) lead[key] = value;
      });
      if (bulkFunnelValue) {
        lead.funnelStage = normalizeFunnelStage(bulkFunnelValue);
        lead.marketingTracked = Boolean(lead.funnelStage);
      }
      lead.updatedAt = todayIso();
      enrichLead(lead);
    });
    saveState();
    renderAll();
    setToast(`已更新 ${state.selected.size} 位客戶`);
  }

  async function writeTextToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function copyConsentLinkForLead(id, type = "consent") {
    const lead = getLead(id);
    if (!lead) return;
    const contact = await syncLeadToBackend(lead);
    const payload = await apiRequest(`/api/admin/contacts/${encodeURIComponent(contact.id)}/consent-links`);
    const link = type === "unsubscribe" ? payload.unsubscribeUrl : payload.consentUrl;
    await writeTextToClipboard(link);

    lead.marketingOptIn = Boolean(payload.marketingOptIn);
    lead.unsubscribed = Boolean(payload.unsubscribed);
    lead.consentUrl = payload.consentUrl || lead.consentUrl || "";
    lead.unsubscribeUrl = payload.unsubscribeUrl || lead.unsubscribeUrl || "";
    saveState();
    renderAll();
    setToast(type === "unsubscribe" ? "退訂連結已複製" : "同意頁連結已複製");
  }

  async function syncConsentStatuses({ silent = false } = {}) {
    const leadsWithEmail = state.leads.filter((lead) => normalizeText(lead.email));
    if (!leadsWithEmail.length) {
      if (!silent) setToast("沒有可同步的 Email 客戶");
      return 0;
    }

    await apiRequest("/api/admin/contacts/import", {
      method: "POST",
      body: JSON.stringify({ contacts: leadsWithEmail.map(leadPayloadFromLead) }),
    });

    const payload = await apiRequest("/api/admin/contacts?limit=500");
    const byEmail = new Map((payload.contacts || []).map((contact) => [contact.email.toLowerCase(), contact]));
    let updated = 0;
    state.leads.forEach((lead) => {
      const contact = byEmail.get(String(lead.email || "").toLowerCase());
      if (!contact) return;
      lead.marketingOptIn = Boolean(contact.marketingOptIn);
      lead.unsubscribed = Boolean(contact.unsubscribed);
      lead.marketingConsentSource = contact.marketingConsentSource || lead.marketingConsentSource || "";
      if (contact.lifecycleStage === "点击/互动") {
        lead.funnelStage = "客户点击链接";
        lead.marketingTracked = true;
      } else if (["邮件打开", "邮件送达", "邮件发送"].includes(contact.lifecycleStage) && !lead.funnelStage) {
        lead.funnelStage = "邮件发送";
        lead.marketingTracked = true;
      }
      updated += 1;
    });

    saveState();
    renderAll();
    if (!silent) setToast(`已同步 ${updated} 位客戶的同意/退訂狀態`);
    return updated;
  }

  async function syncBackendContacts({ silent = false } = {}) {
    if (!adminToken()) {
      if (!silent) setToast("請先輸入 Admin API Token");
      updateDataSourceBadge();
      return 0;
    }
    updateDataSourceBadge("同步後端中...");
    const updated = await syncConsentStatuses({ silent: true });
    state.backendSyncedAt = new Date().toLocaleString("zh-HK", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    saveState();
    renderAll();
    if (!silent) setToast(`已同步 ${updated} 位客戶到後端`);
    return updated;
  }

  function scheduleBackendSyncFromToken() {
    window.clearTimeout(adminTokenSyncTimer);
    updateDataSourceBadge();
    if (!adminToken()) return;
    adminTokenSyncTimer = window.setTimeout(() => {
      runAsync(() => syncBackendContacts({ silent: true }));
    }, 700);
  }

  async function deleteSelectedLeads() {
    if (state.selected.size === 0) {
      setToast("請先選擇客戶");
      return;
    }
    const ids = [...state.selected];
    const hasAdminToken = Boolean(adminToken());
    const scopeText = hasAdminToken ? "同步刪除後端 CRM 客戶與相關郵件會話" : "刪除本地主表資料，輸入 Admin Token 後可同步後端";
    if (!confirm(`確認批量刪除 ${ids.length} 位客戶？此操作會${scopeText}。`)) return;

    if (hasAdminToken) {
      await apiRequest("/api/admin/contacts/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
    }

    state.leads = state.leads.filter((lead) => !state.selected.has(lead.id));
    state.selected.clear();
    saveState();
    renderAll();
    setToast(hasAdminToken ? `已批量刪除 ${ids.length} 位客戶` : `已刪除本地主表 ${ids.length} 位客戶；輸入 Token 可同步後端`);
  }

  function addImportLog(message) {
    state.importLog.unshift(`${new Date().toLocaleString()} · ${message}`);
    state.importLog = state.importLog.slice(0, IMPORT_LOG_LIMIT);
  }

  function normalizeHeader(header) {
    return String(header || "")
      .toLowerCase()
      .replace(/[\s_/\-()（）:：]+/g, "");
  }

  function valueBy(row, aliases) {
    const normalized = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]);
    for (const alias of aliases) {
      const target = normalizeHeader(alias);
      const match = normalized.find(([key]) => key === target || key.includes(target));
      if (match) return normalizeText(match[1]);
    }
    return "";
  }

  function rowToLead(row) {
    const importedFunnelStage = normalizeFunnelStage(
      valueBy(row, ["Funnel Stage", "Marketing Funnel Stage", "漏斗階段", "漏斗阶段"]),
    );
    const lead = {
      id: valueBy(row, ["Lead ID", "lead_id", "客戶編號"]) || makeId("IMPORT"),
      year: valueBy(row, ["Year", "Program Year", "年份"]),
      company: valueBy(row, ["Company", "公司", "公司名稱"]),
      chineseName: valueBy(row, ["Chinese Name", "中文名稱"]),
      industry: valueBy(row, ["Industry Group", "行業", "類別"]),
      productCategory: valueBy(row, ["Product Category", "產品類別"]),
      brand: valueBy(row, ["Brand", "品牌"]),
      contact: valueBy(row, ["Contact", "聯絡人"]),
      title: valueBy(row, ["Title", "職位"]),
      email: valueBy(row, ["Email", "電郵", "郵箱"]),
      phone: valueBy(row, ["Phone", "電話"]),
      website: valueBy(row, ["Website", "網址"]),
      platformStage: valueBy(row, ["Mainland Platform Stage", "Platform Stage", "平台階段"]),
      platforms: valueBy(row, ["Mainland Platforms", "Platforms", "內地平台"]),
      targetCustomer: valueBy(row, ["Target Customer", "目標客戶", "目標客群"]),
      painPoints: valueBy(row, ["Pain Points", "痛點"]),
      needs: valueBy(row, ["Needs / Expectations", "Needs", "期望", "需求"]),
      segment: valueBy(row, ["Service Segment", "Segment", "分流"]),
      funnelStage: importedFunnelStage,
      marketingTracked: Boolean(importedFunnelStage),
      outreachStatus: valueBy(row, ["Outreach Status", "觸達狀態"]),
      priority: valueBy(row, ["Priority", "優先級"]),
      owner: valueBy(row, ["Owner", "負責人"]),
      lastContacted: valueBy(row, ["Last Contacted", "上次觸達"]),
      nextFollowUp: valueBy(row, ["Next Follow-up", "Next Follow Up", "下次跟進"]),
      notes: valueBy(row, ["Notes", "備註"]),
      source: "Imported spreadsheet",
      sourceConfidence: "High",
      createdAt: todayIso(),
    };
    return enrichLead(lead);
  }

  function parseTextLead(text, fileName) {
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const phone = (text.match(/(?:\+?\d[\d\s().-]{6,}\d)/) || [""])[0];
    const readAfter = (labels, stops) => {
      const labelPattern = labels.join("|");
      const stopPattern = stops.join("|");
      const regex = new RegExp(`(?:${labelPattern})\\s*[:：]?\\s*([\\s\\S]{0,500}?)(?=\\n\\s*(?:${stopPattern})\\s*[:：]?|$)`, "i");
      const match = text.match(regex);
      return normalizeText(match ? match[1] : "");
    };
    const lead = {
      id: makeId("UPLOAD"),
      company: readAfter(["公司名稱", "公司名称", "Company Name"], ["聯絡人", "联系人", "Contact"]) || fileName.replace(/\.[^.]+$/, ""),
      contact: readAfter(["聯絡人", "联系人", "Contact"], ["職位", "职位", "Title", "電郵", "Email"]),
      title: readAfter(["職位", "职位", "Title"], ["電郵", "Email", "聯絡電話"]),
      email,
      phone,
      website: readAfter(["公司網址", "公司网址", "Website"], ["為了解", "1\\.", "貴公司目前"]),
      platforms: readAfter(["內地社交媒體", "內地电商平台", "Mainland Platform"], ["貴公司什麼時候", "请简介", "請簡介"]),
      startTime: readAfter(["貴公司什麼時候開始內地電商業務", "什么时候开始"], ["請簡介", "请简介"]),
      productCategory: readAfter(["產品類別", "产品类别"], ["品牌"]),
      brand: readAfter(["品牌"], ["品牌故事", "產品賣點", "目标", "目標"]),
      story: readAfter(["品牌故事", "產品賣點", "产品卖点"], ["目標客群", "目标客群", "痛點"]),
      targetCustomer: readAfter(["目標客群", "目标客群", "Target Customer"], ["就內地", "痛點", "痛点"]),
      painPoints: readAfter(["痛點是什麼", "痛点是什么", "Pain Points"], ["貴公司對發展", "发展内地"]),
      needs: readAfter(["首要期望", "有何期望", "Expectations"], ["貴公司對本次", "本次諮詢"]),
      consultingExpectations: readAfter(["本次諮詢服務有什麼期望", "咨询服务有什么期望"], ["Thank you", "多謝合作"]),
      source: fileName,
      sourceConfidence: text.length < 80 ? "Low" : "Medium",
      createdAt: todayIso(),
    };
    if (!email && text.length < 80) {
      lead.company = fileName.replace(/\.[^.]+$/, "");
      lead.outreachStatus = "KYC Required";
      lead.dataCompleteness = "Low";
      lead.notes = "上傳文件未能提取有效文字，可能為掃描 PDF，需要人工補錄或 OCR。";
    }
    return enrichLead(lead);
  }

  function ocrLines(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => normalizeText(line.replace(/[|•·]+/g, " ")))
      .filter((line) => line.length > 1);
  }

  function stripFieldLabel(line) {
    return normalizeText(
      line.replace(
        /^(company|company name|organisation|organization|business name|name|contact|contact person|person in charge|title|position|job title|department|dept\.?|tel|telephone|mobile|phone|fax|email|e-mail|website|web|address|公司名稱|公司名称|公司名|公司|機構|机构|商號|商号|姓名|姓名名稱|聯絡人|联系人|負責人|负责人|職銜|职衔|職位|职位|頭銜|头衔|部門|部门|電話|电话|手提|手機|手机|傳真|传真|電郵|邮箱|電子郵件|电子邮件|網址|网址|網站|网站|地址)\s*[:：\-–—]?\s*/i,
        "",
      ),
    );
  }

  function extractWebsite(text, email) {
    const source = String(text || "");
    const explicit = source.match(
      /(?:https?:\/\/|www\.)[a-z0-9][a-z0-9-]*(?:\s*\.\s*[a-z0-9][a-z0-9-]*)*\s*\.\s*(?:com\.hk|com\.cn|com|hk|cn|net|org|co|io|asia|biz|info)(?:\/[^\s]*)?/i,
    );
    if (explicit) return explicit[0].replace(/\s*\.\s*/g, ".").replace(/[),.;]+$/, "");
    const candidates = [...source.matchAll(/[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.(?:com\.hk|com\.cn|com|hk|cn|net|org|co|io|asia|biz|info)(?:\/[^\s]*)?/gi)]
      .filter((match) => source[Math.max(0, match.index - 1)] !== "@")
      .map((match) => match[0].replace(/[),.;]+$/, ""));
    if (candidates.length) return candidates[0];
    const domain = email && email.split("@")[1];
    return domain ? `www.${domain}` : "";
  }

  function extractPhones(text) {
    const matches = String(text || "").match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g) || [];
    return [...new Set(matches.map((phone) => normalizeText(phone)).filter((phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }))];
  }

  function lineAfterLabel(lines, labelPattern) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const direct = line.match(labelPattern);
      if (direct?.[1]) return { value: stripFieldLabel(direct[1]), line, index };
      if (labelPattern.test(line) && lines[index + 1]) return { value: stripFieldLabel(lines[index + 1]), line: lines[index + 1], index: index + 1 };
    }
    return null;
  }

  function stripContactFragments(line) {
    return normalizeText(
      String(line || "")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
        .replace(/(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\S*/gi, " ")
        .replace(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g, " "),
    );
  }

  function extractCompanyName(line) {
    const cleaned = stripFieldLabel(stripContactFragments(line));
    const chineseOnly = cleaned.match(/([\u3400-\u9fff（）()&·・]{2,50}(?:有限公司|有限责任公司|集團|集团|公司|企業|企业|貿易|贸易|國際|国际|控股|科技|藥業|药业|製品|制品|工程|設計|设计|發展|发展|食品|餐飲|餐饮|電器|電子|电子))/i);
    if (chineseOnly) return normalizeText(chineseOnly[1]);
    const chinese = cleaned.match(/([\u3400-\u9fffA-Za-z0-9（）()&·・'’.,\s-]{2,70}?(?:有限公司|有限责任公司|集團|集团|公司|企業|企业|貿易|贸易|國際|国际|控股|科技|藥業|药业|製品|制品|工程|設計|设计|發展|发展|食品|餐飲|餐饮|電器|電子|电子))/i);
    if (chinese) return normalizeText(chinese[1]);
    const english = cleaned.match(/([A-Z][A-Za-z0-9&'’.,() -]{2,90}?\s+(?:Limited|Ltd\.?|Company|Co\.?|Corporation|Corp\.?|Group|Holdings?|Enterprise(?:s)?|International|Industrial|Industries|Trading|Technology|Pharmaceutical|Design|Development|Manufactur(?:ing|er|y)|Factory|Foods?))/i);
    if (english) return normalizeText(english[1]);
    return cleaned;
  }

  function domainTokens(email, website) {
    const domain = normalizeText((email && email.split("@")[1]) || website)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0];
    return domain
      .split(/[.\-]/)
      .filter((token) => token.length >= 4 && !/^(com|hk|net|org|asia|www)$/i.test(token));
  }

  function scoreCompanyLine(line, index, email, website) {
    let score = 0;
    const cleaned = stripContactFragments(line);
    if (HK_COMPANY_PATTERN.test(cleaned)) score += 7;
    if (/^(company|company name|公司名稱|公司名称|公司名|公司|商號|商号|機構|机构)\s*[:：\-–—]/i.test(line)) score += 4;
    if (domainTokens(email, website).some((token) => cleaned.toLowerCase().includes(token))) score += 2;
    if (index <= 4) score += 1.5;
    if (HK_TITLE_PATTERN.test(cleaned)) score -= 2;
    if (CONTACT_NOISE_PATTERN.test(line)) score -= 5;
    if (cleaned.length < 2 || cleaned.length > 90) score -= 2;
    return score;
  }

  function scoreTitleLine(line) {
    let score = 0;
    const cleaned = stripFieldLabel(stripContactFragments(line));
    if (HK_TITLE_PATTERN.test(cleaned)) score += 7;
    if (/^(title|position|job title|職銜|职衔|職位|职位|頭銜|头衔)\s*[:：\-–—]/i.test(line)) score += 4;
    if (HK_COMPANY_PATTERN.test(cleaned)) score -= 4;
    if (CONTACT_NOISE_PATTERN.test(line)) score -= 5;
    if (cleaned.length < 2 || cleaned.length > 70) score -= 2;
    return score;
  }

  function likelyEnglishName(line) {
    const cleaned = stripFieldLabel(line).replace(/\s+/g, " ").trim();
    if (!/^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,4}$/.test(cleaned)) return false;
    return !HK_TITLE_PATTERN.test(cleaned) && !HK_COMPANY_PATTERN.test(cleaned);
  }

  function likelyChineseName(line) {
    const compact = stripFieldLabel(line).replace(/[^\u3400-\u9fff]/g, "");
    return compact.length >= 2 && compact.length <= 5 && HK_SURNAME_PATTERN.test(compact) && !HK_COMPANY_PATTERN.test(line);
  }

  function scoreNameLine(line, index, companyLine, titleLine) {
    const cleaned = stripFieldLabel(stripContactFragments(line));
    if (!cleaned || line === companyLine || line === titleLine) return -10;
    let score = 0;
    if (/^(name|contact|contact person|person in charge|姓名|聯絡人|联系人|負責人|负责人)\s*[:：\-–—]/i.test(line)) score += 7;
    if (likelyChineseName(cleaned)) score += 5;
    if (likelyEnglishName(cleaned)) score += 4;
    if (index <= 3) score += 1.5;
    if (titleLine && index < 8) score += 1;
    if (HK_TITLE_PATTERN.test(cleaned)) score -= 5;
    if (HK_COMPANY_PATTERN.test(cleaned)) score -= 6;
    if (CONTACT_NOISE_PATTERN.test(line)) score -= 6;
    if (cleaned.length < 2 || cleaned.length > 45) score -= 3;
    return score;
  }

  function bestScoredLine(lines, scorer, minimumScore) {
    const ranked = lines.map((line, index) => ({ line, index, score: scorer(line, index) })).sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= minimumScore ? ranked[0] : null;
  }

  function nameFromEmail(email) {
    const local = normalizeText((email || "").split("@")[0]);
    if (!/[._-]/.test(local)) return "";
    const parts = local
      .split(/[._-]+/)
      .filter((part) => /^[a-z]{2,}$/i.test(part))
      .slice(0, 3);
    if (parts.length < 2) return "";
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
  }

  function leadingChineseNameFromText(text) {
    const compact = normalizeText(text).replace(/\s+/g, "");
    const firstHanRun = compact.match(/[\u3400-\u9fff]{2,}/)?.[0] || "";
    if (!firstHanRun || !HK_SURNAME_PATTERN.test(firstHanRun)) return "";
    const titleIndex = firstHanRun.search(/主席|副主席|董事|董事長|董事长|常務董事|執行董事|創辦人|创办人|合夥人|合伙人|總裁|总裁|行政總裁|行政总裁|總經理|总经理|副總經理|副总经理|經理|经理|主任|主管|負責人|负责人|顧問|顾问|代表|銷售|销售|營銷|营销|市場|市场|業務|业务|營運|营运|採購|采购|財務|财务|會計|会计|設計師|设计师|工程師|工程师|藥劑師|药剂师|助理|秘書|秘书/);
    const candidate = titleIndex > 0 ? firstHanRun.slice(0, titleIndex) : firstHanRun.slice(0, Math.min(3, firstHanRun.length));
    return candidate.length >= 2 && candidate.length <= 5 && HK_SURNAME_PATTERN.test(candidate) ? candidate : "";
  }

  function extractSmartCardFields(text) {
    const lines = ocrLines(text);
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const phone = extractPhones(text).join(" / ");
    const website = extractWebsite(text, email);
    const labeledCompany = lineAfterLabel(lines, /^(?:company(?:\s*name)?|organisation|organization|business name|公司名稱|公司名称|公司名|公司|商號|商号|機構|机构)\s*[:：\-–—]?\s*(.*)$/i);
    const companyChoice =
      labeledCompany && labeledCompany.value
        ? { line: labeledCompany.line, index: labeledCompany.index, value: extractCompanyName(labeledCompany.value) }
        : bestScoredLine(lines, (line, index) => scoreCompanyLine(line, index, email, website), 4.5);
    const company = companyChoice ? extractCompanyName(companyChoice.value || companyChoice.line) : "";
    const labeledTitle = lineAfterLabel(lines, /^(?:title|position|job title|職銜|职衔|職位|职位|頭銜|头衔|部門|部门)\s*[:：\-–—]?\s*(.*)$/i);
    const titleChoice =
      labeledTitle && labeledTitle.value
        ? { line: labeledTitle.line, index: labeledTitle.index, value: stripFieldLabel(labeledTitle.value) }
        : bestScoredLine(lines, (line) => scoreTitleLine(line), 3.5);
    const title = titleChoice ? stripFieldLabel(titleChoice.value || titleChoice.line) : "";
    const labeledName = lineAfterLabel(lines, /^(?:name|contact|contact person|person in charge|姓名|聯絡人|联系人|負責人|负责人)\s*[:：\-–—]?\s*(.*)$/i);
    const nameChoice =
      labeledName && labeledName.value
        ? { line: labeledName.line, index: labeledName.index, value: stripFieldLabel(labeledName.value) }
        : bestScoredLine(lines, (line, index) => scoreNameLine(line, index, companyChoice?.line, titleChoice?.line), 3.5);
    const contact = nameChoice ? stripFieldLabel(nameChoice.value || nameChoice.line) : leadingChineseNameFromText(text) || nameFromEmail(email);
    return { lines, email, phone, website, company, contact, title };
  }

  function ocrLineObjects(data) {
    const sourceLines = Array.isArray(data?.lines) ? data.lines : [];
    return sourceLines
      .map((line) => {
        const text = normalizeText(line.text || "");
        const box = line.bbox || {};
        const hasBox = [box.x0, box.y0, box.x1, box.y1].every((value) => Number.isFinite(Number(value)));
        return {
          text,
          confidence: Number(line.confidence) || Number(data?.confidence) || 0,
          bbox: hasBox
            ? {
                x0: Number(box.x0),
                y0: Number(box.y0),
                x1: Number(box.x1),
                y1: Number(box.y1),
              }
            : null,
        };
      })
      .filter((line) => line.text.length > 1);
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.floor(sorted.length / 2)];
  }

  function boxesTouch(a, b, padX, padY) {
    return !(
      a.x1 + padX < b.x0 ||
      b.x1 + padX < a.x0 ||
      a.y1 + padY < b.y0 ||
      b.y1 + padY < a.y0
    );
  }

  function textBlocksFromLines(lines) {
    const blocks = [];
    let current = [];
    const hasContactSignal = (items) =>
      items.some((line) => /@|www\.|https?:|tel|mobile|phone|電話|电话|手機|手机|\d{4,}/i.test(line));
    const likelyNewCardStart = (line) =>
      /(有限公司|集团|集團|公司|limited|ltd\.?|company|co\.|corporation|corp\.|group|holdings|enterprise|international)/i.test(line) ||
      /^(name|contact|姓名|聯絡人|联系人)\s*[:：-]/i.test(line);
    lines.forEach((line) => {
      if (current.length >= 3 && hasContactSignal(current) && likelyNewCardStart(line)) {
        blocks.push(current.join("\n"));
        current = [];
      }
      if (current.some((item) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(item)) && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line)) {
        blocks.push(current.join("\n"));
        current = [];
      }
      current.push(line);
    });
    if (current.length) blocks.push(current.join("\n"));
    return blocks.filter((block) => normalizeText(block).length > 5);
  }

  function groupOcrTextBlocks(data) {
    const lineObjects = ocrLineObjects(data);
    const boxed = lineObjects.filter((line) => line.bbox);
    if (boxed.length < 3) return textBlocksFromLines(ocrLines(data?.text || ""));
    const heights = boxed.map((line) => line.bbox.y1 - line.bbox.y0);
    const pageWidth = Math.max(...boxed.map((line) => line.bbox.x1));
    const pageHeight = Math.max(...boxed.map((line) => line.bbox.y1));
    const lineHeight = Math.max(10, median(heights));
    const padX = Math.max(pageWidth * 0.035, lineHeight * 3.5);
    const padY = Math.max(pageHeight * 0.025, lineHeight * 2.2);
    const parent = boxed.map((_, index) => index);
    const find = (index) => {
      while (parent[index] !== index) {
        parent[index] = parent[parent[index]];
        index = parent[index];
      }
      return index;
    };
    const unite = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    };
    for (let i = 0; i < boxed.length; i += 1) {
      for (let j = i + 1; j < boxed.length; j += 1) {
        if (boxesTouch(boxed[i].bbox, boxed[j].bbox, padX, padY)) unite(i, j);
      }
    }
    const groups = new Map();
    boxed.forEach((line, index) => {
      const root = find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(line);
    });
    const blocks = [...groups.values()]
      .map((group) => {
        const sorted = group.sort((a, b) => {
          const dy = a.bbox.y0 - b.bbox.y0;
          return Math.abs(dy) > lineHeight * 0.7 ? dy : a.bbox.x0 - b.bbox.x0;
        });
        const box = {
          x0: Math.min(...sorted.map((line) => line.bbox.x0)),
          y0: Math.min(...sorted.map((line) => line.bbox.y0)),
          x1: Math.max(...sorted.map((line) => line.bbox.x1)),
          y1: Math.max(...sorted.map((line) => line.bbox.y1)),
        };
        return {
          text: sorted.map((line) => line.text).join("\n"),
          confidence: Math.round(sorted.reduce((sum, line) => sum + line.confidence, 0) / sorted.length),
          box,
        };
      })
      .filter((block) => normalizeText(block.text).length > 5)
      .sort((a, b) => {
        const dy = a.box.y0 - b.box.y0;
        return Math.abs(dy) > pageHeight * 0.08 ? dy : a.box.x0 - b.box.x0;
      });
    if (blocks.length <= 1) {
      return textBlocksFromLines(ocrLines(data?.text || "")).map((text) => ({
        text,
        confidence: Number(data?.confidence) || 0,
      }));
    }
    return blocks;
  }

  function normalizeEntity(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/(有限公司|有限责任公司|集团|集團|公司|limited|ltd\.?|company|co\.?|corporation|corp\.?|group|holdings|enterprise|international)/gi, "")
      .replace(/[^\p{Script=Han}a-z0-9]+/giu, "");
  }

  function businessDomain(lead) {
    const emailDomain = lead.email && lead.email.split("@")[1];
    const websiteDomain = lead.website && lead.website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
    const domain = normalizeText(emailDomain || websiteDomain).toLowerCase();
    return /^(gmail|hotmail|outlook|yahoo|icloud|qq|163|126)\./i.test(domain) ? "" : domain;
  }

  function overlapPhones(a, b) {
    const phonesA = extractPhones(a.phone || "").map((phone) => phone.replace(/\D/g, ""));
    const phonesB = extractPhones(b.phone || "").map((phone) => phone.replace(/\D/g, ""));
    return phonesA.some((phone) => phone && phonesB.includes(phone));
  }

  function shouldMergeBusinessCards(a, b) {
    const emailA = normalizeText(a.email).toLowerCase();
    const emailB = normalizeText(b.email).toLowerCase();
    if (emailA && emailB && emailA === emailB) return true;
    const companyA = normalizeEntity(a.company);
    const companyB = normalizeEntity(b.company);
    const contactA = normalizeEntity(a.contact);
    const contactB = normalizeEntity(b.contact);
    const sameCompany = companyA && companyB && companyA === companyB;
    const sameContact = contactA && contactB && contactA === contactB;
    const sameDomain = businessDomain(a) && businessDomain(a) === businessDomain(b);
    if (sameContact && (sameCompany || sameDomain || overlapPhones(a, b))) return true;
    if (sameCompany && (!contactA || !contactB) && (!emailA || !emailB || sameDomain)) return true;
    if (sameDomain && (!companyA || !companyB || sameCompany) && (!contactA || !contactB || sameContact)) return true;
    if (overlapPhones(a, b) && (sameCompany || sameContact)) return true;
    return false;
  }

  function mergeTextList(a, b) {
    const values = [...String(a || "").split(" / "), ...String(b || "").split(" / ")]
      .map((value) => normalizeText(value))
      .filter(Boolean);
    return [...new Set(values)].join(" / ");
  }

  function mergeBusinessCardLead(target, incoming) {
    ["company", "contact", "title", "email", "website", "brand", "targetCustomer", "painPoints", "needs"].forEach((field) => {
      if (!target[field] && incoming[field]) target[field] = incoming[field];
    });
    target.phone = mergeTextList(target.phone, incoming.phone);
    target.notes = mergeTextList(target.notes, incoming.notes);
    target.sourceConfidence = ["High", "Medium", "Low"].find((level) => [target.sourceConfidence, incoming.sourceConfidence].includes(level)) || "Low";
    enrichLead(target);
    return target;
  }

  function mergeBusinessCardLeads(leads) {
    const merged = [];
    leads.forEach((lead) => {
      const existing = merged.find((item) => shouldMergeBusinessCards(item, lead));
      if (existing) {
        mergeBusinessCardLead(existing, lead);
      } else {
        merged.push(lead);
      }
    });
    return merged;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src.endsWith(src.replace("./", "")));
      if (existing && window.Tesseract?.recognize) {
        resolve();
        return;
      }
      if (existing) existing.remove();
      const script = document.createElement("script");
      script.src = `${src}?reload=${Date.now()}`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function getTesseract() {
    if (window.Tesseract?.recognize) return window.Tesseract;
    window.self = window.self || window;
    await loadScript("./vendor/tesseract.min.js");
    return window.Tesseract;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function canvasToBlob(canvas, type = "image/png", quality = 0.95) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function canvasFromBlob(blob, maxLongEdge = 3600) {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      const scale = Math.min(1, maxLongEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function updateOcrProgress(label, percent) {
    const progress = Number.isFinite(percent) ? ` ${Math.round(percent)}%` : "";
    $("importLog").firstChild &&
      ($("importLog").firstChild.textContent = `${new Date().toLocaleString()} · ${label}${progress}`);
  }

  function activeRanges(values, threshold, mergeGap, minSize) {
    const ranges = [];
    let start = null;
    let lastActive = null;
    values.forEach((value, index) => {
      if (value > threshold) {
        if (start === null) start = index;
        lastActive = index;
      } else if (start !== null && index - lastActive > mergeGap) {
        if (lastActive - start + 1 >= minSize) ranges.push([start, lastActive]);
        start = null;
        lastActive = null;
      }
    });
    if (start !== null && lastActive - start + 1 >= minSize) ranges.push([start, lastActive]);
    return ranges;
  }

  function mergeCloseRects(rects) {
    const merged = [];
    rects.forEach((rect) => {
      const existing = merged.find((item) => {
        const xOverlap = Math.max(0, Math.min(item.x + item.w, rect.x + rect.w) - Math.max(item.x, rect.x));
        const yOverlap = Math.max(0, Math.min(item.y + item.h, rect.y + rect.h) - Math.max(item.y, rect.y));
        const overlap = xOverlap * yOverlap;
        const minArea = Math.min(item.w * item.h, rect.w * rect.h);
        return minArea && overlap / minArea > 0.55;
      });
      if (existing) {
        const x0 = Math.min(existing.x, rect.x);
        const y0 = Math.min(existing.y, rect.y);
        const x1 = Math.max(existing.x + existing.w, rect.x + rect.w);
        const y1 = Math.max(existing.y + existing.h, rect.y + rect.h);
        Object.assign(existing, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      } else {
        merged.push({ ...rect });
      }
    });
    return merged;
  }

  function mergeStackedCardRegions(rects, canvas) {
    const merged = [];
    rects
      .slice()
      .sort((a, b) => (Math.abs(a.y - b.y) > canvas.height * 0.04 ? a.y - b.y : a.x - b.x))
      .forEach((rect) => {
        const target = merged.find((item) => {
          const xOverlap = Math.max(0, Math.min(item.x + item.w, rect.x + rect.w) - Math.max(item.x, rect.x));
          const overlapRatio = xOverlap / Math.max(1, Math.min(item.w, rect.w));
          const verticalGap = Math.max(0, rect.y - (item.y + item.h), item.y - (rect.y + rect.h));
          const x0 = Math.min(item.x, rect.x);
          const y0 = Math.min(item.y, rect.y);
          const x1 = Math.max(item.x + item.w, rect.x + rect.w);
          const y1 = Math.max(item.y + item.h, rect.y + rect.h);
          const unionW = x1 - x0;
          const unionH = y1 - y0;
          const cardLikeAspect = unionH / Math.max(1, unionW) <= 0.95;
          return overlapRatio > 0.28 && verticalGap <= Math.max(40, canvas.height * 0.06) && cardLikeAspect;
        });
        if (target) {
          const x0 = Math.min(target.x, rect.x);
          const y0 = Math.min(target.y, rect.y);
          const x1 = Math.max(target.x + target.w, rect.x + rect.w);
          const y1 = Math.max(target.y + target.h, rect.y + rect.h);
          Object.assign(target, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, reason: "card-merged" });
        } else {
          merged.push({ ...rect });
        }
      });
    return merged.sort((a, b) => (Math.abs(a.y - b.y) > canvas.height * 0.05 ? a.y - b.y : a.x - b.x));
  }

  function detectVisualCardRegions(canvas) {
    const maxSample = 900;
    const scale = Math.min(1, maxSample / Math.max(canvas.width, canvas.height));
    const sample = document.createElement("canvas");
    sample.width = Math.max(1, Math.round(canvas.width * scale));
    sample.height = Math.max(1, Math.round(canvas.height * scale));
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    sampleContext.drawImage(canvas, 0, 0, sample.width, sample.height);
    const image = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
    const rowInk = new Array(sample.height).fill(0);
    const isInk = (offset) => {
      const r = image[offset];
      const g = image[offset + 1];
      const b = image[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      return (luma < 242 && max - min > 8) || luma < 215;
    };
    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        if (isInk((y * sample.width + x) * 4)) rowInk[y] += 1;
      }
    }
    const rowRanges = activeRanges(
      rowInk,
      Math.max(3, sample.width * 0.004),
      Math.round(clamp(sample.height * 0.035, 18, 80)),
      Math.round(clamp(sample.height * 0.035, 28, 120)),
    );
    const rects = [];
    rowRanges.forEach(([rowStart, rowEnd]) => {
      const colInk = new Array(sample.width).fill(0);
      for (let y = rowStart; y <= rowEnd; y += 1) {
        for (let x = 0; x < sample.width; x += 1) {
          if (isInk((y * sample.width + x) * 4)) colInk[x] += 1;
        }
      }
      const colRanges = activeRanges(
        colInk,
        Math.max(3, (rowEnd - rowStart + 1) * 0.004),
        Math.round(clamp(sample.width * 0.035, 18, 80)),
        Math.round(clamp(sample.width * 0.045, 45, 180)),
      );
      colRanges.forEach(([colStart, colEnd]) => {
        const pad = Math.round(24 * (1 / scale));
        const x = Math.max(0, Math.round(colStart / scale) - pad);
        const y = Math.max(0, Math.round(rowStart / scale) - pad);
        const x1 = Math.min(canvas.width, Math.round((colEnd + 1) / scale) + pad);
        const y1 = Math.min(canvas.height, Math.round((rowEnd + 1) / scale) + pad);
        const w = x1 - x;
        const h = y1 - y;
        const area = w * h;
        if (w > canvas.width * 0.12 && h > canvas.height * 0.035 && area > canvas.width * canvas.height * 0.012) {
          rects.push({ x, y, w, h, reason: "visual" });
        }
      });
    });
    return mergeCloseRects(rects)
      .filter((rect) => rect.w > 80 && rect.h > 60)
      .sort((a, b) => (Math.abs(a.y - b.y) > canvas.height * 0.05 ? a.y - b.y : a.x - b.x));
  }

  function fallbackTileRegions(canvas) {
    const regions = [];
    const aspect = canvas.height / canvas.width;
    if (aspect > 1.75) {
      const tileHeight = Math.round(clamp(canvas.width * 0.72, 620, 1250));
      const overlap = Math.round(tileHeight * 0.12);
      for (let y = 0; y < canvas.height; y += tileHeight - overlap) {
        const h = Math.min(tileHeight, canvas.height - y);
        if (h > tileHeight * 0.35) regions.push({ x: 0, y, w: canvas.width, h, reason: "long-image" });
      }
      return regions;
    }
    const columns = canvas.width > canvas.height * 0.95 ? 2 : 1;
    const rows = Math.max(1, Math.min(5, Math.ceil(canvas.height / ((canvas.width / columns) * 0.68))));
    const overlapX = Math.round(canvas.width * 0.015);
    const overlapY = Math.round(canvas.height * 0.018);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const x0 = Math.max(0, Math.round((canvas.width / columns) * col) - overlapX);
        const y0 = Math.max(0, Math.round((canvas.height / rows) * row) - overlapY);
        const x1 = Math.min(canvas.width, Math.round((canvas.width / columns) * (col + 1)) + overlapX);
        const y1 = Math.min(canvas.height, Math.round((canvas.height / rows) * (row + 1)) + overlapY);
        regions.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, reason: "grid" });
      }
    }
    return regions;
  }

  function regionListForCanvas(canvas) {
    const visual = mergeStackedCardRegions(detectVisualCardRegions(canvas), canvas);
    const totalArea = canvas.width * canvas.height;
    const oneBigRegion = visual.length === 1 && (visual[0].w * visual[0].h) / totalArea > 0.72;
    const canvasAspect = canvas.height / Math.max(1, canvas.width);
    if (visual.length === 1 && canvasAspect >= 0.35 && canvasAspect <= 0.95) return visual;
    if (visual.length > 1 && visual.length <= 10) {
      const x0 = Math.max(0, Math.min(...visual.map((rect) => rect.x)) - Math.round(canvas.width * 0.03));
      const y0 = Math.max(0, Math.min(...visual.map((rect) => rect.y)) - Math.round(canvas.height * 0.03));
      const x1 = Math.min(canvas.width, Math.max(...visual.map((rect) => rect.x + rect.w)) + Math.round(canvas.width * 0.03));
      const y1 = Math.min(canvas.height, Math.max(...visual.map((rect) => rect.y + rect.h)) + Math.round(canvas.height * 0.03));
      const union = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, reason: "single-card-union" };
      if (union.h / Math.max(1, union.w) <= 0.95) return [union];
    }
    if (visual.length >= 2 && visual.length <= 24) return visual;
    if (canvas.height / canvas.width > 1.75 || oneBigRegion || visual.length === 0) return fallbackTileRegions(canvas);
    return visual;
  }

  function cropAndEnhance(canvas, rect) {
    const pad = Math.round(Math.min(rect.w, rect.h) * 0.06);
    const x = Math.max(0, rect.x - pad);
    const y = Math.max(0, rect.y - pad);
    const w = Math.min(canvas.width - x, rect.w + pad * 2);
    const h = Math.min(canvas.height - y, rect.h + pad * 2);
    const targetLongEdge = 2100;
    const scale = clamp(targetLongEdge / Math.max(w, h), 1, 3.2);
    const out = document.createElement("canvas");
    out.width = Math.round(w * scale);
    out.height = Math.round(h * scale);
    const context = out.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, out.width, out.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
    const imageData = context.getImageData(0, 0, out.width, out.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = clamp((gray - 128) * 1.28 + 128, 0, 255);
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    context.putImageData(imageData, 0, 0);
    return out;
  }

  function parseBusinessCardLead(text, fileName, confidence = 0, index = 1) {
    const fields = extractSmartCardFields(text);
    const { email, phone, website, company, contact, title } = fields;
    const extractedFields = [email, phone, website, company, contact, title].filter(Boolean).length;
    const sourceConfidence = extractedFields >= 4 && confidence >= 45 ? "High" : extractedFields >= 2 ? "Medium" : "Low";
    const rawSnippet = normalizeText(text).slice(0, 700);
    return enrichLead({
      id: makeId("CARD"),
      company: company || fileName.replace(/\.[^.]+$/, ""),
      contact,
      title,
      email,
      phone,
      website,
      targetCustomer: "",
      painPoints: "",
      needs: "",
      source: fileName,
      sourceConfidence,
      dataCompleteness: sourceConfidence === "Low" ? "Low" : "",
      outreachStatus: sourceConfidence === "Low" || !email ? "KYC Required" : "",
      notes: `图片 OCR 识别导入，名片区块 ${index}，置信度约 ${Math.round(confidence || 0)}。已尝试合并同一公司/同一人正反面资料，请人工核对。${rawSnippet ? ` OCR 原文：${rawSnippet}` : ""}`,
      createdAt: todayIso(),
      marketingTracked: false,
      funnelStage: "",
    });
  }

  function ocrSignalScore(data) {
    const fields = extractSmartCardFields(data?.text || "");
    let score = 0;
    if (fields.email) score += 4;
    if (fields.phone) score += 3;
    if (fields.website) score += 2;
    if (fields.company) score += 4;
    if (fields.contact) score += 3;
    if (fields.title) score += 3;
    score += Math.min(3, (Number(data?.confidence) || 0) / 25);
    return score;
  }

  async function runBusinessCardTesseract(blob, label, pageSegMode) {
    const tesseract = await getTesseract();
    if (!tesseract?.recognize) throw new Error("OCR engine is not available");
    const result = await tesseract.recognize(blob, OCR_LANGUAGES, {
      workerPath: "./vendor/tesseract-worker.min.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      tessedit_pageseg_mode: pageSegMode,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      logger: (message) => {
        if (message.status && typeof message.progress === "number") {
          updateOcrProgress(`${label}: OCR ${message.status}`, message.progress * 100);
        }
      },
    });
    return result?.data || {};
  }

  async function recognizeBusinessCardImage(blob, label) {
    const primary = await runBusinessCardTesseract(blob, label, "6");
    const primaryScore = ocrSignalScore(primary);
    if (primaryScore >= 9 || Number(primary.confidence) >= 62) return primary;
    const sparse = await runBusinessCardTesseract(blob, `${label} 粵繁增强`, "11");
    return ocrSignalScore(sparse) > primaryScore ? sparse : primary;
  }

  async function ocrCanvasToBusinessCardLeads(canvas, sourceName, pageLabel = "图片") {
    const regions = regionListForCanvas(canvas);
    const allBlocks = [];
    const allLeads = [];
    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index];
      const enhanced = cropAndEnhance(canvas, region);
      updateOcrProgress(`${sourceName} ${pageLabel}: 识别区域 ${index + 1}/${regions.length}`);
      const data = await recognizeBusinessCardImage(await canvasToBlob(enhanced), `${sourceName} ${pageLabel} 区域 ${index + 1}`);
      if (!normalizeText(data.text || "").length && !(data.lines || []).length) continue;
      const fullText = data.text || "";
      const emailCount = (fullText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length;
      const blocks = groupOcrTextBlocks(data).filter((block) => normalizeText(block.text).length > 4);
      const shouldSplitRegion = blocks.length > 1 && emailCount > 1;
      const usableBlocks =
        shouldSplitRegion ? blocks : [{ text: fullText, confidence: data.confidence || Math.max(...blocks.map((block) => block.confidence || 0), 0) }];
      usableBlocks.forEach((block, blockIndex) => {
        if (normalizeText(block.text).length <= 4) return;
        const sequence = allBlocks.length + 1;
        allBlocks.push({ ...block, region });
        allLeads.push(
          parseBusinessCardLead(
            block.text,
            sourceName,
            block.confidence || data.confidence || 0,
            sequence,
            `${pageLabel} 区域 ${index + 1}${usableBlocks.length > 1 ? `.${blockIndex + 1}` : ""}`,
          ),
        );
      });
    }
    if (!allLeads.length && regions.length > 1) {
      updateOcrProgress(`${sourceName} ${pageLabel}: 分区未命中，回退整页识别`, 92);
      const enhanced = cropAndEnhance(canvas, { x: 0, y: 0, w: canvas.width, h: canvas.height });
      const data = await recognizeBusinessCardImage(await canvasToBlob(enhanced), `${sourceName} ${pageLabel} 整页`);
      const blocks = groupOcrTextBlocks(data).filter((block) => normalizeText(block.text).length > 4);
      const usableBlocks = blocks.length ? blocks : [{ text: data.text || "", confidence: data.confidence || 0 }];
      usableBlocks.forEach((block, index) => {
        if (normalizeText(block.text).length <= 4) return;
        allBlocks.push(block);
        allLeads.push(parseBusinessCardLead(block.text, sourceName, block.confidence || data.confidence || 0, index + 1));
      });
    }
    return { blocks: allBlocks, leads: allLeads };
  }

  async function parseImage(file) {
    addImportLog(`${file.name}: 圖片 OCR 分區識別中...`);
    renderImportLog();
    try {
      const canvas = await canvasFromBlob(file);
      const result = await ocrCanvasToBusinessCardLeads(canvas, file.name, canvas.height / canvas.width > 1.75 ? "长图切片" : "图片");
      const merged = mergeBusinessCardLeads(result.leads);
      addImportLog(`${file.name}: OCR 識別 ${result.blocks.length || 1} 個名片區塊，合併為 ${merged.length} 位客戶`);
      return merged.length ? merged : [parseBusinessCardLead("", file.name, 0, 1)];
    } catch (error) {
      console.error(error);
      return [
        enrichLead({
          id: makeId("CARD"),
          company: file.name.replace(/\.[^.]+$/, ""),
          dataCompleteness: "Low",
          outreachStatus: "KYC Required",
          source: file.name,
          sourceConfidence: "Low",
          notes: "圖片 OCR 未能完成，請確認圖片清晰度或人工補錄名片資料。",
          createdAt: todayIso(),
        }),
      ];
    }
  }

  async function loadPdfDocument(file) {
    const pdfjs = await import("./vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
    const buffer = await file.arrayBuffer();
    return pdfjs.getDocument({ data: buffer }).promise;
  }

  async function canvasFromPdfPage(doc, pageNo) {
    const page = await doc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }

  async function extractPdfText(doc) {
    const pages = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n");
  }

  function parsePdfTextLayer(text, fileName) {
    const normalized = normalizeText(text);
    const emails = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const looksLikeQuestionnaire = /公司名稱|公司名称|貴公司|贵公司|申請表格|申请表格|問卷|问卷|產品類別|产品类别|目標客群|目标客群/.test(normalized);
    if (!looksLikeQuestionnaire && (emails.length > 1 || textBlocksFromLines(ocrLines(normalized)).length > 1)) {
      const blocks = textBlocksFromLines(ocrLines(normalized));
      const leads = blocks.map((block, index) => parseBusinessCardLead(block, fileName, 75, index + 1));
      const merged = mergeBusinessCardLeads(leads);
      if (merged.length) return merged;
    }
    return [parseTextLead(text, fileName)];
  }

  async function parsePdf(file) {
    addImportLog(`${file.name}: PDF 解析中...`);
    renderImportLog();
    const doc = await loadPdfDocument(file);
    const text = await extractPdfText(doc);
    const normalizedText = normalizeText(text);
    if (normalizedText.length >= 120) {
      const textLeads = parsePdfTextLayer(text, file.name);
      addImportLog(`${file.name}: 讀取 PDF 文字層，生成 ${textLeads.length} 位客戶`);
      return textLeads;
    }
    const allBlocks = [];
    const allLeads = [];
    addImportLog(`${file.name}: PDF 文字層不足，改用逐頁渲染 + 分區 OCR`);
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      updateOcrProgress(`${file.name}: 渲染 PDF 第 ${pageNo}/${doc.numPages} 页`);
      const canvas = await canvasFromPdfPage(doc, pageNo);
      const result = await ocrCanvasToBusinessCardLeads(canvas, file.name, `PDF 第 ${pageNo} 页`);
      allBlocks.push(...result.blocks);
      allLeads.push(...result.leads);
    }
    const merged = mergeBusinessCardLeads(allLeads);
    addImportLog(`${file.name}: PDF OCR 識別 ${allBlocks.length || 1} 個名片區塊，合併為 ${merged.length} 位客戶`);
    return merged.length ? merged : [parseTextLead(text, file.name)];
  }

  async function parseFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["xlsx", "xls", "csv"].includes(ext)) {
      const data = ext === "csv" ? await file.text() : await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: ext === "csv" ? "string" : "array" });
      const sheetName = workbook.SheetNames.includes("CRM_Master") ? "CRM_Master" : workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      return rows.map(rowToLead).filter((lead) => lead.company || lead.email);
    }
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return [parseTextLead(result.value, file.name)];
    }
    if (ext === "pdf") {
      return parsePdf(file);
    }
    if (["txt", "md"].includes(ext)) {
      return [parseTextLead(await file.text(), file.name)];
    }
    if (IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith("image/")) {
      return parseImage(file);
    }
    return [
      enrichLead({
        id: makeId("UPLOAD"),
        company: file.name,
        dataCompleteness: "Low",
        outreachStatus: "KYC Required",
        notes: "不支援的文件格式，請轉為 XLSX、CSV、DOCX、PDF 或 TXT。",
        source: file.name,
        sourceConfidence: "Low",
      }),
    ];
  }

  function upsertLeads(newLeads) {
    let added = 0;
    let updated = 0;
    newLeads.forEach((incoming) => {
      const keyEmail = incoming.email && incoming.email.toLowerCase();
      const existing = state.leads.find(
        (lead) =>
          (keyEmail && lead.email.toLowerCase() === keyEmail) ||
          (!keyEmail && lead.company && lead.company.toLowerCase() === incoming.company.toLowerCase()),
      );
      if (existing) {
        Object.assign(existing, incoming, { id: existing.id, updatedAt: todayIso() });
        enrichLead(existing);
        updated += 1;
      } else {
        incoming.id = incoming.id && !getLead(incoming.id) ? incoming.id : makeId("IMPORT");
        state.leads.push(enrichLead(incoming));
        added += 1;
      }
    });
    return { added, updated };
  }

  async function handleFiles(files) {
    let added = 0;
    let updated = 0;
    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        const result = upsertLeads(parsed);
        added += result.added;
        updated += result.updated;
        addImportLog(`${file.name}: 新增 ${result.added} / 更新 ${result.updated}`);
      } catch (error) {
        console.error(error);
        addImportLog(`${file.name}: 解析失敗，請檢查文件格式`);
      }
    }
    saveState();
    renderAll();
    if (adminToken()) {
      await syncBackendContacts({ silent: true });
      setToast(`導入完成：新增 ${added}，更新 ${updated}，已同步後端`);
    } else {
      setToast(`導入完成：新增 ${added}，更新 ${updated}`);
    }
  }

  function exportWorkbook() {
    const crmRows = state.leads.map((lead) => ({
      "Lead ID": lead.id,
      Year: lead.year,
      Company: lead.company,
      "Chinese Name": lead.chineseName,
      "Industry Group": lead.industry,
      "Product Category": lead.productCategory,
      Brand: lead.brand,
      Contact: lead.contact,
      Title: lead.title,
      Email: lead.email,
      Phone: lead.phone,
      Website: lead.website,
      "Mainland Platform Stage": lead.platformStage,
      "Mainland Platforms": lead.platforms,
      "Start Time": lead.startTime,
      "Target Customer": lead.targetCustomer,
      "Pain Points": lead.painPoints,
      "Needs / Expectations": lead.needs,
      "Service Segment": lead.segment,
      "Data Completeness": lead.dataCompleteness,
      "Lead Score": lead.leadScore,
      Priority: lead.priority,
      "Marketing Opt-in": lead.marketingOptIn ? "Yes" : "No",
      Unsubscribed: lead.unsubscribed ? "Yes" : "No",
      "Marketing Tracked": lead.marketingTracked ? "Yes" : "No",
      "Funnel Stage": lead.funnelStage || NO_FUNNEL_STAGE,
      "Outreach Status": lead.outreachStatus,
      Owner: lead.owner,
      "Last Contacted": lead.lastContacted,
      "Next Follow-up": lead.nextFollowUp,
      Notes: lead.notes,
      Source: lead.source,
    }));
    const outreachRows = state.leads.map((lead) => ({
      "Lead ID": lead.id,
      Company: lead.company,
      Contact: lead.contact,
      Email: lead.email,
      "Marketing Opt-in": lead.marketingOptIn ? "Yes" : "No",
      Unsubscribed: lead.unsubscribed ? "Yes" : "No",
      Segment: lead.segment,
      "Marketing Tracked": lead.marketingTracked ? "Yes" : "No",
      "Funnel Stage": lead.funnelStage || NO_FUNNEL_STAGE,
      Subject: lead.emailSubject || "跟進香港好物節諮詢：平台增長與CRM分流",
      "Opening Hook": lead.hook || lead.painPoints,
      CTA: lead.cta || "安排20分鐘確認主推SKU、渠道和90日預算。",
      Status: lead.outreachStatus,
      Owner: lead.owner,
      "Next Follow-up": lead.nextFollowUp,
    }));
    const stats = getFunnelStats();
    const funnelRows = DEFAULT_FUNNEL.map((stage, index) => {
      const previous = index === 0 ? stats.total : stats.cumulative[DEFAULT_FUNNEL[index - 1].name] || 0;
      const cumulative = stats.cumulative[stage.name] || 0;
      return {
        Stage: `阶段 ${stage.step}`,
        "Funnel Stage": stage.name,
        "Total Customers": stats.total,
        "Tracked Customers": stats.tracked,
        "Current Stage Count": stats.exact[stage.name] || 0,
        "Cumulative Covered": cumulative,
        "Stage Conversion Rate": previous ? `${Math.round((cumulative / previous) * 100)}%` : "0%",
        "Overall Share": stats.total ? `${Math.round((cumulative / stats.total) * 100)}%` : "0%",
      };
    });
    funnelRows.push({
      Stage: "Summary",
      "Funnel Stage": "综合转化率",
      "Total Customers": stats.total,
      "Tracked Customers": stats.tracked,
      "Current Stage Count": stats.converted,
      "Cumulative Covered": stats.tracked,
      "Stage Conversion Rate": `${stats.conversionRate}%`,
      "Overall Share": `${stats.conversionRate}%`,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(crmRows), "CRM_Master");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(outreachRows), "Email_Outreach");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(funnelRows), "Funnel_Analysis");
    XLSX.writeFile(workbook, `TDC_CRM_Web_Export_${todayIso()}.xlsx`);
  }

  function runAsync(task) {
    task().catch((error) => {
      setToast(error.message);
      console.error(error);
    });
  }

  function loadTabData(tabName) {
    if (tabName === "inbox") return loadInbox();
    if (tabName === "templates") return loadTemplates();
    if (tabName === "designer") return loadDesignerPage();
    if (tabName === "campaigns") return loadCampaigns();
    if (tabName === "analysis") return loadEmailAnalytics();
    return Promise.resolve();
  }

  function wireEvents() {
    wireAdminTokenInputs();

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
        tab.classList.add("active");
        $(`${tab.dataset.tab}Pane`).classList.add("active");
        runAsync(async () => {
          await loadTabData(tab.dataset.tab);
          if (tab.dataset.tab === "designer") refreshEmailDesignerLayout();
        });
      });
    });

    ["search", "segment", "funnel", "status", "priority"].forEach((key) => {
      const id = key === "search" ? "searchInput" : `${key}Filter`;
      $(id).addEventListener("input", (event) => {
        state.filters[key] = event.target.value;
        renderTable();
        if (window.lucide) window.lucide.createIcons();
      });
    });

    $("clearFiltersBtn").addEventListener("click", () => {
      Object.keys(state.filters).forEach((key) => (state.filters[key] = ""));
      $("searchInput").value = "";
      ["segmentFilter", "funnelFilter", "statusFilter", "priorityFilter"].forEach((id) => ($(id).value = ""));
      renderTable();
    });

    $("fileInput").addEventListener("change", (event) => handleFiles([...event.target.files]));
    ["dragenter", "dragover"].forEach((eventName) => {
      $("dropZone").addEventListener(eventName, (event) => {
        event.preventDefault();
        $("dropZone").classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      $("dropZone").addEventListener(eventName, (event) => {
        event.preventDefault();
        $("dropZone").classList.remove("dragover");
      });
    });
    $("dropZone").addEventListener("drop", (event) => handleFiles([...event.dataTransfer.files]));

    $("crmTableBody").addEventListener("click", (event) => {
      const emailButton = event.target.closest("[data-email-lead]");
      if (emailButton) {
        openDrawerForEmail(emailButton.dataset.emailLead);
        return;
      }
      const open = event.target.closest("[data-open]");
      if (open) {
        openDrawer(open.dataset.open);
        return;
      }
      const deleteButton = event.target.closest("[data-delete-lead]");
      if (deleteButton) deleteLeadById(deleteButton.dataset.deleteLead);
      const consentButton = event.target.closest("[data-copy-consent]");
      if (consentButton) {
        runAsync(() => copyConsentLinkForLead(consentButton.dataset.copyConsent, "consent"));
        return;
      }
      const unsubscribeButton = event.target.closest("[data-copy-unsubscribe]");
      if (unsubscribeButton) {
        runAsync(() => copyConsentLinkForLead(unsubscribeButton.dataset.copyUnsubscribe, "unsubscribe"));
      }
    });
    $("crmTableBody").addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-select]");
      if (checkbox) {
        checkbox.checked ? state.selected.add(checkbox.dataset.select) : state.selected.delete(checkbox.dataset.select);
        $("selectedCount").textContent = state.selected.size;
        return;
      }
      const editable = event.target.closest("[data-edit]");
      if (editable) updateLeadField(editable.dataset.id, editable.dataset.edit, editable.type === "checkbox" ? editable.checked : editable.value);
    });
    $("selectAll").addEventListener("change", (event) => {
      const leads = getFilteredLeads();
      leads.forEach((lead) => (event.target.checked ? state.selected.add(lead.id) : state.selected.delete(lead.id)));
      renderTable();
      if (window.lucide) window.lucide.createIcons();
    });

    $("applyBulkBtn").addEventListener("click", applyBulk);
    $("syncConsentStatusBtn").addEventListener("click", () => runAsync(syncBackendContacts));
    $("syncBackendContactsBtn").addEventListener("click", () => runAsync(syncBackendContacts));
    $("deleteSelectedBtn").addEventListener("click", () => runAsync(deleteSelectedLeads));
    $("addLeadBtn").addEventListener("click", () => openDrawer(null));
    $("closeDrawerBtn").addEventListener("click", closeDrawer);
    $("leadForm").addEventListener("submit", saveLeadFromForm);
    $("emailField").addEventListener("input", (event) => {
      $("emailRecipientField").value = event.target.value.trim();
      renderEmailComposerAssist();
    });
    $("emailPurposeField").addEventListener("change", updateMarketingPurposeNotice);
    $("marketingOptInField").addEventListener("change", updateMarketingPurposeNotice);
    ["companyField", "contactField", "painField", "nextField", "emailSubjectField", "emailBodyField", "emailSignatureField"].forEach((id) => {
      $(id).addEventListener("input", renderEmailComposerAssist);
    });
    $("emailBodyField").addEventListener("input", () => {
      $("emailBodyField").dataset.htmlContent = "";
    });
    $("drawerTemplateSelect").addEventListener("change", renderEmailComposerAssist);
    $("deleteLeadBtn").addEventListener("click", deleteCurrentLead);
    $("applyDrawerTemplateBtn").addEventListener("click", () => runAsync(applySelectedTemplateToDrawer));
    $("sendEmailBtn").addEventListener("click", sendDrawerEmail);
    $("testSendBtn").addEventListener("click", () => runAsync(sendTestEmail));
    $("saveDraftBtn").addEventListener("click", () => saveCurrentEmailDraft());
    $("clearDraftBtn").addEventListener("click", clearCurrentEmailDraft);
    $("refreshEmailsBtn").addEventListener("click", refreshEmailHistory);
    $("emailTimeline").addEventListener("click", (event) => {
      const reply = event.target.closest("[data-reply-thread]");
      if (!reply) return;
      prepareDrawerReply({
        threadId: reply.dataset.replyThread,
        subject: reply.dataset.replySubject,
        fromEmail: reply.dataset.replyFrom,
      });
    });
    $("refreshInboxBtn").addEventListener("click", () => runAsync(loadInbox));
    $("inboxSearchInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") runAsync(loadInbox);
    });
    ["inboxReadFilter", "inboxStatusFilter"].forEach((id) => {
      $(id).addEventListener("change", () => runAsync(loadInbox));
    });
    $("inboxAssigneeFilter").addEventListener("keydown", (event) => {
      if (event.key === "Enter") runAsync(loadInbox);
    });
    $("saveThreadMetaBtn").addEventListener("click", () => runAsync(saveActiveThreadMeta));
    $("useInboxTemplateBtn").addEventListener("click", () => runAsync(useInboxReplyTemplate));
    $("openThreadContactBtn").addEventListener("click", openActiveThreadContact);
    $("inboxList").addEventListener("click", (event) => {
      const thread = event.target.closest("[data-open-thread]");
      if (thread) {
        runAsync(() => openInboxThread(thread.dataset.openThread));
        return;
      }
      const reply = event.target.closest("[data-inbox-reply]");
      if (reply) {
        replyToInboxMessage(reply.dataset.inboxReply);
        return;
      }
      const contact = event.target.closest("[data-inbox-open-contact]");
      if (contact) openInboxContact(contact.dataset.inboxOpenContact);
      const readButton = event.target.closest("[data-inbox-read]");
      if (readButton) {
        runAsync(() => markInboxThreadRead(readButton.dataset.inboxRead, readButton.dataset.readValue === "true"));
      }
    });
    $("templateForm").addEventListener("submit", (event) => runAsync(() => saveTemplate(event)));
    $("resetTemplateBtn").addEventListener("click", resetTemplateForm);
    $("templateList").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-template]");
      if (edit) {
        editTemplate(edit.dataset.editTemplate);
        return;
      }
      const design = event.target.closest("[data-design-template]");
      if (design) {
        document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
        document.querySelector('[data-tab="designer"]').classList.add("active");
        $("designerPane").classList.add("active");
        runAsync(async () => {
          await loadDesignerPage();
          await openDesignerTemplate(design.dataset.designTemplate);
        });
        return;
      }
      const remove = event.target.closest("[data-delete-template]");
      if (remove) {
        runAsync(() => deleteTemplate(remove.dataset.deleteTemplate));
        return;
      }
      const use = event.target.closest("[data-use-template]");
      if (use) applyTemplateToDrawer(use.dataset.useTemplate);
    });
    $("campaignForm").addEventListener("submit", (event) => runAsync(() => saveCampaign(event)));
    $("designerForm").addEventListener("submit", (event) => runAsync(() => saveDesignerTemplate(event)));
    $("designerTemplateSelect").addEventListener("change", (event) => runAsync(() => openDesignerTemplate(event.target.value)));
    $("designerAssetUploadField").addEventListener("change", (event) => {
      runAsync(async () => {
        await initializeEmailDesigner();
        await uploadDesignerAssetFiles(event.target.files || []);
        event.target.value = "";
      });
    });
    $("designerRefreshAssetsBtn").addEventListener("click", () => runAsync(loadDesignerAssets));
    $("designerAssetLibrary").addEventListener("click", (event) => {
      const insert = event.target.closest("[data-insert-designer-asset]");
      if (insert) {
        insertDesignerAsset(insert.dataset.insertDesignerAsset);
        return;
      }
      const remove = event.target.closest("[data-delete-designer-asset]");
      if (remove) runAsync(() => deleteDesignerAsset(remove.dataset.deleteDesignerAsset));
    });
    $("designerLoadTextBtn").addEventListener("click", () => updateDesignerTextPanel());
    $("designerNormalizeTextBtn").addEventListener("click", () => applyDesignerStableText({ normalizeOnly: true }));
    $("designerApplyTextBtn").addEventListener("click", () => applyDesignerStableText());
    $("designerRefreshTextBlocksBtn").addEventListener("click", () => refreshDesignerTextBlocks());
    $("designerApplyTextStyleAllBtn").addEventListener("click", () => applyDesignerTextStyleAll());
    $("designerNormalizeAllTextBtn").addEventListener("click", () => applyDesignerTextStyleAll({ normalizeTextContent: true }));
    $("designerTextBlockList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-designer-text-block]");
      if (button) selectDesignerTextBlock(button.dataset.designerTextBlock);
    });
    $("designerFocusEditorBtn").addEventListener("click", () => toggleDesignerFocusMode());
    $("designerTextContentField").addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      const field = event.currentTarget;
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? field.value.length;
      field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
      const nextPosition = start + text.length;
      field.setSelectionRange(nextPosition, nextPosition);
    });
    $("designerNewBtn").addEventListener("click", () => runAsync(async () => {
      await initializeEmailDesigner();
      resetDesignerForm();
    }));
    $("designerPreviewBtn").addEventListener("click", () => runAsync(async () => {
      await initializeEmailDesigner();
      previewDesignerHtml();
    }));
    $("designerTokenButtons").addEventListener("click", (event) => {
      const button = event.target.closest("[data-designer-token]");
      if (button) insertDesignerToken(button.dataset.designerToken);
    });
    $("refreshCampaignsBtn").addEventListener("click", () => runAsync(loadCampaigns));
    $("newCampaignBtn").addEventListener("click", resetCampaignWizard);
    $("campaignTemplateSelect").addEventListener("change", applyCampaignTemplate);
    $("campaignTextField").addEventListener("input", () => {
      $("campaignTextField").dataset.htmlContent = "";
      renderCampaignPreview();
    });
    $("estimateCampaignBtn").addEventListener("click", () => runAsync(estimateCampaignAudience));
    $("testCampaignBtn").addEventListener("click", () => runAsync(testCampaignSend));
    $("startCampaignBtn").addEventListener("click", () => runAsync(startCampaign));
    $("refreshCampaignReportBtn").addEventListener("click", () => runAsync(loadCampaignReport));
    document.querySelectorAll("[data-campaign-step]").forEach((button) => {
      button.addEventListener("click", () => setCampaignStep(button.dataset.campaignStep));
    });
    $("campaignForm").addEventListener("click", (event) => {
      const next = event.target.closest("[data-next-campaign-step]");
      if (next) setCampaignStep(next.dataset.nextCampaignStep);
    });
    $("campaignList").addEventListener("click", (event) => {
      const select = event.target.closest("[data-select-campaign]");
      if (select) {
        selectCampaign(select.dataset.selectCampaign);
        return;
      }
      const report = event.target.closest("[data-report-campaign]");
      if (report) {
        selectCampaign(report.dataset.reportCampaign);
        setCampaignStep(6);
        return;
      }
      const remove = event.target.closest("[data-delete-campaign]");
      if (remove) runAsync(() => deleteCampaign(remove.dataset.deleteCampaign));
    });
    $("exportBtn").addEventListener("click", exportWorkbook);
    $("resetSeedBtn").addEventListener("click", () => {
      if (!confirm("確認還原到初始 CRM 資料？目前本地修改會被覆蓋。")) return;
      localStorage.removeItem(STORAGE_KEY);
      state.selected.clear();
      state.backendSyncedAt = "";
      loadState();
      renderAll();
      setToast("已還原初始資料");
    });

    $("followupList").addEventListener("click", (event) => {
      const item = event.target.closest("[data-open]");
      if (item) openDrawer(item.dataset.open);
    });

    window.addEventListener("resize", () => {
      if ($("designerPane")?.classList.contains("active")) refreshEmailDesignerLayout();
    });
  }

  loadState();
  wireEvents();
  renderAll();
  if (adminToken()) runAsync(() => syncBackendContacts({ silent: true }));
})();
