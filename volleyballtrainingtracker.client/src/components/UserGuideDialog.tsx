import { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Dialog } from "@/components/ui/dialog";
import guideMarkdown from "@/content/user-guide.md?raw";

interface UserGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 使用說明彈窗：以 react-markdown 渲染 src/content/user-guide.md。
 * 目錄中的錨點連結（#章節）由 rehype-slug 產生對應 id，點擊時於彈窗內平滑捲動。
 */
export default function UserGuideDialog({ open, onClose }: UserGuideDialogProps) {
  // 攔截目錄錨點：在彈窗容器內捲動，不更動瀏覽器網址列的 hash
  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const target = e.currentTarget.querySelector(`#${CSS.escape(id)}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  return (
    <Dialog open={open} onClose={onClose} size="xl" title="使用說明">
      <div
        onClick={handleAnchorClick}
        className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:scroll-mt-4
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-th:text-left"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
          {guideMarkdown}
        </ReactMarkdown>
      </div>
    </Dialog>
  );
}
