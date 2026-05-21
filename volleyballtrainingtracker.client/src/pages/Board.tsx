import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Heart,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  X,
  Check,
  Inbox,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { boardApi, type BoardPost, type BoardComment } from "@/api/board";
import { getApiErrorMessage } from "@/api/client";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { useAuthStore, PERM } from "@/stores/authStore";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const MAX_POST = 2000;
const MAX_COMMENT = 1000;

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return iso.slice(0, 10);
}

export default function BoardPage() {
  const qc = useQueryClient();
  const canManage = useAuthStore((s) => s.can)(PERM.BoardManage);
  const [page, setPage] = useState(1);
  const [compose, setCompose] = useState("");

  const queryKey = ["board", page];
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => boardApi.list({ page, pageSize: PAGE_SIZE }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["board"] });

  const createMut = useMutation({
    mutationFn: (content: string) => boardApi.create(content),
    onSuccess: async () => {
      setCompose("");
      // 新貼文在第一頁最上面，回到第一頁確保看得到
      if (page !== 1) setPage(1);
      else await invalidate();
      showSuccess("已發布");
    },
    onError: (e) => showError(getApiErrorMessage(e, "發布失敗")),
  });

  const busy = createMut.isPending;

  const submitCompose = () => {
    const text = compose.trim();
    if (!text) return showError("請輸入內容");
    if (text.length > MAX_POST) return showError(`內容最長 ${MAX_POST} 字`);
    createMut.mutate(text);
  };

  const posts = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-info" />
            留言板
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            隊內公告與交流 — 發文、回覆、按讚
          </p>
        </div>
      </div>

      {/* 發文框 */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <Textarea
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (!busy) submitCompose();
              }
            }}
            maxLength={MAX_POST}
            rows={3}
            placeholder="分享一則訊息給全隊…（Ctrl/⌘ + Enter 送出）"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {compose.length}/{MAX_POST}
            </span>
            <Button onClick={submitCompose} disabled={busy || !compose.trim()}>
              <Send className="h-4 w-4 mr-1" /> 發布
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 清單 */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="還沒有任何留言"
          description="在上方發布第一則訊息吧"
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canManage={canManage}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}

      {/* 分頁 */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> 上一頁
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            第 {page} / {totalPages} 頁
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!data.hasMore || isFetching}
          >
            下一頁 <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── 貼文卡片 ─────────────────────────────────────────────────────────────

function PostCard({
  post,
  canManage,
  onChanged,
}: {
  post: BoardPost;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const after = async () => {
    await onChanged();
  };

  const editMut = useMutation({
    mutationFn: (content: string) => boardApi.update(post.id, content),
    onSuccess: async () => {
      setEditing(false);
      await after();
      showSuccess("已更新");
    },
    onError: (e) => showError(getApiErrorMessage(e, "更新失敗")),
  });

  const deleteMut = useMutation({
    mutationFn: () => boardApi.remove(post.id),
    onSuccess: async () => {
      await after();
      showSuccess("已刪除");
    },
    onError: (e) => showError(getApiErrorMessage(e, "刪除失敗")),
  });

  const pinMut = useMutation({
    mutationFn: () => boardApi.togglePin(post.id),
    onSuccess: after,
    onError: (e) => showError(getApiErrorMessage(e, "操作失敗")),
  });

  const reactMut = useMutation({
    mutationFn: () => boardApi.toggleReaction(post.id),
    onSuccess: after,
    onError: (e) => showError(getApiErrorMessage(e, "操作失敗")),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => boardApi.addComment(post.id, content),
    onSuccess: async () => {
      setReplyText("");
      setShowReply(false);
      await after();
    },
    onError: (e) => showError(getApiErrorMessage(e, "回覆失敗")),
  });

  const busy =
    editMut.isPending ||
    deleteMut.isPending ||
    pinMut.isPending ||
    reactMut.isPending ||
    replyMut.isPending;

  const handleDelete = async () => {
    const res = await confirmAction("刪除這則貼文？", post.content.slice(0, 60), "刪除", true);
    if (res.isConfirmed) deleteMut.mutate();
  };

  const submitEdit = () => {
    const t = editText.trim();
    if (!t) return showError("內容不可為空");
    editMut.mutate(t);
  };

  const submitReply = () => {
    const t = replyText.trim();
    if (!t) return;
    if (t.length > MAX_COMMENT) return showError(`回覆最長 ${MAX_COMMENT} 字`);
    replyMut.mutate(t);
  };

  return (
    <Card className={cn(post.isPinned && "border-warning/50 bg-warning/5")}>
      <CardContent className="py-4 space-y-3">
        {/* 標頭 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {post.isPinned && (
              <Chip tone="warning" size="sm">
                <Pin className="h-3 w-3 mr-0.5" /> 置頂
              </Chip>
            )}
            <span className="font-medium truncate">{post.authorName}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatRelative(post.createdAt)}
            </span>
            {post.edited && (
              <span className="text-xs text-muted-foreground/70">（已編輯）</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => pinMut.mutate()}
                disabled={busy}
                title={post.isPinned ? "取消置頂" : "置頂"}
              >
                {post.isPinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            )}
            {post.canEdit && !editing && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditText(post.content);
                  setEditing(true);
                }}
                disabled={busy}
                title="編輯"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {post.canDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                title="刪除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 內文 / 編輯 */}
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={MAX_POST}
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                <X className="h-4 w-4 mr-1" /> 取消
              </Button>
              <Button size="sm" onClick={submitEdit} disabled={busy}>
                <Check className="h-4 w-4 mr-1" /> 儲存
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {post.content}
          </p>
        )}

        {/* 動作列 */}
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => reactMut.mutate()}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-1 transition-colors disabled:opacity-50",
              post.reactedByMe
                ? "text-rose-500"
                : "text-muted-foreground hover:text-rose-500",
            )}
          >
            <Heart
              className={cn("h-4 w-4", post.reactedByMe && "fill-current")}
            />
            <span className="tabular-nums">{post.reactionCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowReply((v) => !v)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="tabular-nums">{post.commentCount}</span>
          </button>
        </div>

        {/* 回覆列表 */}
        {post.comments.length > 0 && (
          <ul className="space-y-2 border-l-2 border-muted pl-3 ml-1">
            {post.comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                busyParent={busy}
                onChanged={after}
              />
            ))}
          </ul>
        )}

        {/* 回覆輸入 */}
        {showReply && (
          <div className="flex items-start gap-2 pl-1">
            <CornerDownRight className="h-4 w-4 mt-2 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (!busy) submitReply();
                  }
                }}
                maxLength={MAX_COMMENT}
                rows={2}
                placeholder="寫回覆…（Ctrl/⌘ + Enter 送出）"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowReply(false);
                    setReplyText("");
                  }}
                  disabled={busy}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={submitReply}
                  disabled={busy || !replyText.trim()}
                >
                  <Send className="h-4 w-4 mr-1" /> 送出
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 回覆列 ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  busyParent,
  onChanged,
}: {
  comment: BoardComment;
  busyParent: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);

  const editMut = useMutation({
    mutationFn: (content: string) => boardApi.updateComment(comment.id, content),
    onSuccess: async () => {
      setEditing(false);
      await onChanged();
      showSuccess("已更新");
    },
    onError: (e) => showError(getApiErrorMessage(e, "更新失敗")),
  });

  const deleteMut = useMutation({
    mutationFn: () => boardApi.removeComment(comment.id),
    onSuccess: async () => {
      await onChanged();
      showSuccess("已刪除");
    },
    onError: (e) => showError(getApiErrorMessage(e, "刪除失敗")),
  });

  const busy = busyParent || editMut.isPending || deleteMut.isPending;

  const handleDelete = async () => {
    const res = await confirmAction("刪除這則回覆？", comment.content.slice(0, 60), "刪除", true);
    if (res.isConfirmed) deleteMut.mutate();
  };

  const submitEdit = () => {
    const t = text.trim();
    if (!t) return showError("回覆不可為空");
    editMut.mutate(t);
  };

  return (
    <li className="group text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatRelative(comment.createdAt)}
            </span>
            {comment.edited && (
              <span className="text-xs text-muted-foreground/70">（已編輯）</span>
            )}
          </div>
          {editing ? (
            <div className="space-y-2 mt-1">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_COMMENT}
                rows={2}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                >
                  取消
                </Button>
                <Button size="sm" onClick={submitEdit} disabled={busy}>
                  儲存
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words mt-0.5">
              {comment.content}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-0.5 shrink-0">
            {comment.canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setText(comment.content);
                  setEditing(true);
                }}
                disabled={busy}
                title="編輯"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {comment.canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleDelete}
                disabled={busy}
                title="刪除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
