import express from "express";
import { requireAdmin } from "../auth.js";
import { deleteEmailMessageById, deleteMessagesForThread, findMessageById, findThreadById, listInboxMessages, listThreadMessages, markThreadRead, updateThread } from "../db.js";
import { publicError } from "../utils.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/inbox", (req, res) => {
  const messages = listInboxMessages({
    search: req.query.search || "",
    status: req.query.status || "",
    read: req.query.read || "",
    assignedTo: req.query.assignedTo || "",
    limit: Math.min(Number(req.query.limit) || 50, 200),
    offset: Number(req.query.offset) || 0,
  });
  res.json({ ok: true, messages });
});

router.get("/threads/:threadId/messages", (req, res, next) => {
  const thread = findThreadById(req.params.threadId);
  if (!thread) return next(publicError("Thread not found", 404));
  return res.json({ ok: true, thread, messages: listThreadMessages(thread.id) });
});

router.patch("/threads/:threadId", (req, res, next) => {
  const thread = updateThread(req.params.threadId, {
    status: req.body.status,
    assignedTo: req.body.assignedTo,
  });
  if (!thread) return next(publicError("Thread not found", 404));
  return res.json({ ok: true, thread });
});

router.post("/threads/:threadId/read", (req, res, next) => {
  const thread = findThreadById(req.params.threadId);
  if (!thread) return next(publicError("Thread not found", 404));
  markThreadRead(thread.id, req.body.read !== false);
  return res.json({ ok: true, thread: findThreadById(thread.id), messages: listThreadMessages(thread.id) });
});

router.delete("/threads/:threadId/messages", (req, res, next) => {
  const thread = findThreadById(req.params.threadId);
  if (!thread) return next(publicError("Thread not found", 404));
  const deleted = deleteMessagesForThread(thread.id);
  return res.json({ ok: true, threadId: thread.id, deleted });
});

router.delete("/messages/:messageId", (req, res, next) => {
  const message = findMessageById(req.params.messageId);
  if (!message) return next(publicError("Message not found", 404));
  const deleted = deleteEmailMessageById(message.id);
  return res.json({ ok: true, messageId: message.id, threadId: message.threadId, deleted });
});

export default router;
