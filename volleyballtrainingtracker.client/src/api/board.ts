import { api } from './client';

export interface BoardComment {
  id: number;
  postId: number;
  content: string;
  authorUserId: number | null;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface BoardPost {
  id: number;
  content: string;
  isPinned: boolean;
  authorUserId: number | null;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
  edited: boolean;
  reactionCount: number;
  reactedByMe: boolean;
  commentCount: number;
  comments: BoardComment[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface BoardList {
  items: BoardPost[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface BoardListQuery {
  page?: number;
  pageSize?: number;
}

export const boardApi = {
  list: (q: BoardListQuery = {}) =>
    api.get<BoardList>('/board', { params: q }).then((r) => r.data),
  get: (id: number) => api.get<BoardPost>(`/board/${id}`).then((r) => r.data),
  create: (content: string) =>
    api.post<BoardPost>('/board', { content }).then((r) => r.data),
  update: (id: number, content: string) =>
    api.put<BoardPost>(`/board/${id}`, { content }).then((r) => r.data),
  remove: (id: number) => api.delete(`/board/${id}`).then(() => {}),
  togglePin: (id: number) =>
    api.post<BoardPost>(`/board/${id}/pin`).then((r) => r.data),
  toggleReaction: (id: number, emoji?: string) =>
    api.post<BoardPost>(`/board/${id}/react`, { emoji }).then((r) => r.data),
  addComment: (postId: number, content: string) =>
    api.post<BoardComment>(`/board/${postId}/comments`, { content }).then((r) => r.data),
  updateComment: (commentId: number, content: string) =>
    api.put<BoardComment>(`/board/comments/${commentId}`, { content }).then((r) => r.data),
  removeComment: (commentId: number) =>
    api.delete(`/board/comments/${commentId}`).then(() => {}),
};
