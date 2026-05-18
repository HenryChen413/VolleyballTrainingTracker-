--
-- PostgreSQL database dump
--

-- Dumped from database version 15.3
-- Dumped by pg_dump version 15.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- 匯入期間停用觸發器/外鍵檢查（因 Users <-> Roles 等循環外鍵）。需以 superuser 身分執行。
SET session_replication_role = replica;

--
-- Data for Name: Roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Roles" ("Id", "Name", "Description", "AllowedPages", "Permissions", "IsSystem", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (1, 'Player', '選手', '["profile","dashboard","players","sessions","match-logs","drills"]', '[]', true, '2026-05-13 13:40:19+08', '2026-05-15 23:34:20+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Roles" ("Id", "Name", "Description", "AllowedPages", "Permissions", "IsSystem", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (2, 'Admin', '系統管理員', '["dashboard","players","sessions","admin-roles","admin-users","profile","match-logs","drills"]', '["players.edit","players.purge","sessions.edit","drills.edit","matchlogs.edit","users.manage","roles.manage"]', true, '2026-05-13 13:41:58+08', '2026-05-15 23:05:07+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Roles" ("Id", "Name", "Description", "AllowedPages", "Permissions", "IsSystem", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (3, 'Coach', '教練', '["dashboard","players","sessions","profile","match-logs","drills"]', '["players.edit","sessions.edit","drills.edit","matchlogs.edit"]', true, '2026-05-13 13:41:58+08', '2026-05-15 23:33:37+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Roles" ("Id", "Name", "Description", "AllowedPages", "Permissions", "IsSystem", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (5, 'Captain', '隊長', '["dashboard","players","sessions","drills","profile","match-logs"]', '["players.edit","drills.edit","sessions.edit","matchlogs.edit"]', true, '2026-05-15 23:32:31+08', '2026-05-15 23:33:57+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Roles" ("Id", "Name", "Description", "AllowedPages", "Permissions", "IsSystem", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (6, 'ViceCaptain', '副隊長', '["dashboard","players","sessions","profile","match-logs","drills"]', '["players.edit","drills.edit","sessions.edit","matchlogs.edit"]', true, '2026-05-15 23:32:31+08', '2026-05-15 23:34:05+08', NULL, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: Users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Users" ("Id", "UserName", "Email", "PasswordHash", "RoleId", "DisplayName", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (2, 'YUANHE', 'apple830927@gmail.com', '$2a$11$CILOXiygNwgl2BtiLQbJiOrsANUqes.zya0l2KFjWvRTQUJJKvURO', 2, '阿和', true, '2026-05-13 08:57:09+08', '2026-05-13 13:43:56+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Users" ("Id", "UserName", "Email", "PasswordHash", "RoleId", "DisplayName", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (3, 'PLAYER1', '', '$2a$11$0Vmq.BLx/3R077kxWGOWTuD5wKYGoOLSx6mqCq5KtPPpqHB/QqJDW', 1, '選手1', true, '2026-05-13 16:14:07+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: AuditDeletes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (1, 'Roles', 4, 2, '2026-05-15 23:09:59+08', '{"Id":4,"AllowedPages":"[]","CreatedAt":"2026-05-15T15:09:54","CreatedByUserId":2,"Description":"test","IsSystem":false,"Name":"test","Permissions":"[]","UpdatedAt":null,"UpdatedByUserId":null}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (2, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":1,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (3, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":2,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (4, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":3,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (5, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":4,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (6, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":8,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (7, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":10,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (8, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":11,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (9, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":13,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (10, 'SessionDrills', 0, 2, '2026-05-18 09:09:53.840136+08', '{"SessionId":7,"DrillId":18,"CreatedAt":"2026-05-17T05:43:17Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (11, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":1,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (12, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":2,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (13, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":3,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (14, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":4,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (15, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":8,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (16, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":10,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (17, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":11,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (18, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":13,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (19, 'SessionDrills', 0, 2, '2026-05-18 09:13:37.518553+08', '{"SessionId":7,"DrillId":18,"CreatedAt":"2026-05-18T01:09:53.840136Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (20, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":1,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (21, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":2,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (22, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":3,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (23, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":4,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (24, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":8,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (25, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":10,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (26, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":11,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (27, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":13,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (28, 'SessionDrills', 0, 2, '2026-05-18 09:15:27.152544+08', '{"SessionId":7,"DrillId":18,"CreatedAt":"2026-05-18T01:13:37.518553Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (29, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":1,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (30, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":2,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (31, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":3,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (32, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":4,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (33, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":8,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (34, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":10,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (35, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":11,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (36, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":13,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (37, 'SessionDrills', 0, 2, '2026-05-18 09:16:41.613507+08', '{"SessionId":7,"DrillId":18,"CreatedAt":"2026-05-18T01:15:27.152544Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (38, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":1,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (39, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":2,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (40, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":3,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (41, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":4,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (42, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":8,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (43, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":10,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (44, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":11,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (45, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":13,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;
INSERT INTO public."AuditDeletes" ("Id", "TableName", "RowId", "DeletedByUserId", "DeletedAt", "RowJson") VALUES (46, 'SessionDrills', 0, 2, '2026-05-18 09:17:25.938745+08', '{"SessionId":7,"DrillId":18,"CreatedAt":"2026-05-18T01:16:41.613507Z","CreatedByUserId":2}') ON CONFLICT DO NOTHING;


--
-- Data for Name: Drills; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (1, '發球練習', 'Serve', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (2, '跪姿發球', 'Serve', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (3, '接發球', 'Pass', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (4, '個人防守', 'Dig', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (5, '舉球', 'Set', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (6, '修正球攻擊', 'Attack', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (7, '拋球連續攻擊', 'Attack', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (8, '自由攻擊', 'Attack', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (9, '攔網', 'Block', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (10, '核心肌群', 'Fitness', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (11, '敏捷訓練', 'Fitness', NULL, true, '2026-05-13 08:56:31+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (12, '自拋自扣', 'Attack', NULL, true, '2026-05-14 10:19:11+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (13, '接嗆司', 'Dig', NULL, true, '2026-05-14 10:19:58+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (14, '直線一長一短', 'Dig', NULL, true, '2026-05-14 10:20:19+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (15, '三人聯防', 'Dig', NULL, true, '2026-05-14 10:21:14+08', '2026-05-16 00:03:50+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (16, '斜線一左一右', 'Dig', NULL, true, '2026-05-14 10:21:33+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (17, '間歇跑', 'Fitness', NULL, true, '2026-05-14 10:21:55+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (18, '修正', 'Set', NULL, true, '2026-05-14 10:37:03+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (19, '跑傳(低手)', 'Basic', NULL, true, '2026-05-14 14:06:27+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (20, '跑傳(高手)', 'Basic', NULL, true, '2026-05-14 14:07:06+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (21, '攻擊步伐', 'Basic', NULL, true, '2026-05-14 14:07:14+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Drills" ("Id", "Name", "Category", "Description", "IsActive", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (22, '攻擊躬身', 'Basic', NULL, true, '2026-05-14 14:07:19+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: MatchEvents; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."MatchEvents" ("Id", "MatchDate", "MatchType", "AcademicYear", "MatchName", "Location", "Ranking", "RankingB", "VideoUrl", "Notes", "SquadCount", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (1, '2026-05-09', 'Friendly', 114, '藥學友誼賽', 'INSIDE', NULL, NULL, 'https://www.youtube.com/watch?v=3IMFGNlizGo&list=PLW7m6dd41vFYP8whPRwhTnvdt-jhQT8Wi', NULL, 1, '2026-05-15 09:45:31+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEvents" ("Id", "MatchDate", "MatchType", "AcademicYear", "MatchName", "Location", "Ranking", "RankingB", "VideoUrl", "Notes", "SquadCount", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (2, '2026-05-06', 'Official', 114, '2026VA', '高醫', NULL, NULL, 'https://www.youtube.com/watch?v=ZeksLXS_uQ8&list=PLW7m6dd41vFbQiE4aauhdjbaZjMiHB8Ij', NULL, 1, '2026-05-15 09:49:20+08', '2026-05-15 09:57:16+08', 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEvents" ("Id", "MatchDate", "MatchType", "AcademicYear", "MatchName", "Location", "Ranking", "RankingB", "VideoUrl", "Notes", "SquadCount", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (3, '2026-02-27', 'Official', 114, '2026大醫盃', '中興大學', '八強', NULL, 'https://www.youtube.com/watch?v=4sRPyJ-gndk&list=PLW7m6dd41vFZwOrttOG2XiqB00Xygbg_Q', NULL, 1, '2026-05-15 09:52:15+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEvents" ("Id", "MatchDate", "MatchType", "AcademicYear", "MatchName", "Location", "Ranking", "RankingB", "VideoUrl", "Notes", "SquadCount", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (4, '2026-04-27', 'Friendly', 114, '高科友誼賽', '高科大第一校區', NULL, NULL, 'https://www.youtube.com/watch?v=_qeFgIaPLsw&list=PLW7m6dd41vFbNXJT8X_ontaNtZ0BimTkf', NULL, 1, '2026-05-15 09:54:07+08', '2026-05-15 14:09:16+08', 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEvents" ("Id", "MatchDate", "MatchType", "AcademicYear", "MatchName", "Location", "Ranking", "RankingB", "VideoUrl", "Notes", "SquadCount", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (5, '2026-03-13', 'Official', 114, '2026啟川盃', '高醫', '亞軍', '第一輪', 'https://www.youtube.com/watch?v=BeCLhobWiQw&list=PLW7m6dd41vFYQnHozgK2aqDRue8bEFNOW', NULL, 2, '2026-05-15 13:53:50+08', '2026-05-15 14:01:35+08', 2, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: Players; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (3, NULL, '王亭之', NULL, 2, 'S', NULL, NULL, 'Right', '2005-06-11', '2026-05-13', 112, 1, NULL, '2026-05-13 15:12:55+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (6, NULL, '陳佑珊', NULL, 6, 'L,OH', NULL, NULL, 'Right', '2004-12-26', '2026-05-13', 112, 1, NULL, '2026-05-13 15:16:46+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (7, NULL, '林晏慈', NULL, 9, 'OPP', NULL, NULL, 'Right', '2005-08-20', '2026-05-13', 112, 1, NULL, '2026-05-13 15:17:23+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (9, NULL, '潘鍾郁晨', NULL, 12, 'OH,OPP', NULL, NULL, 'Right', '2003-09-03', '2026-05-13', 112, 1, NULL, '2026-05-13 15:26:52+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (10, NULL, '邱彥聆', NULL, 3, 'OH', NULL, NULL, 'Right', '2002-12-14', '2026-05-13', 110, 1, NULL, '2026-05-13 15:27:53+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (11, NULL, '陳尚苓', NULL, 7, 'MB', NULL, NULL, 'Right', '2003-03-10', '2026-05-13', 110, 1, NULL, '2026-05-13 15:28:09+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (12, NULL, '劉新庭', NULL, 19, 'L,OPP', NULL, NULL, 'Right', '2003-03-29', '2026-05-13', 110, 1, NULL, '2026-05-13 15:28:26+08', '2026-05-13 15:47:54+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (13, NULL, '謝欣晏', NULL, 13, 'S', NULL, NULL, 'Right', '2003-01-13', '2026-05-13', 111, 1, NULL, '2026-05-13 15:28:49+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (14, NULL, '鄭瑾筠', NULL, 15, 'OPP,OH', NULL, NULL, 'Right', '2004-08-04', '2026-05-13', 111, 1, NULL, '2026-05-13 15:29:04+08', '2026-05-13 15:48:13+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (15, NULL, '蔡孟潔', NULL, 16, 'OH', NULL, NULL, 'Right', '2003-08-03', '2026-05-13', 111, 1, NULL, '2026-05-13 15:29:16+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (16, NULL, '湯宓璇', NULL, 18, 'MB', NULL, NULL, 'Right', '2004-02-26', '2026-05-13', 111, 1, NULL, '2026-05-13 15:29:37+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (17, NULL, '林芯葦', NULL, 4, 'OH', NULL, NULL, 'Right', '2006-04-04', '2026-05-13', 113, 1, NULL, '2026-05-13 15:29:53+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (18, NULL, '王薇筑', NULL, 5, 'OPP', NULL, NULL, 'Right', '2005-03-25', '2026-05-13', 113, 1, NULL, '2026-05-13 15:30:07+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (19, NULL, '黃宜潔', NULL, 10, 'MB', NULL, NULL, 'Right', '2005-01-26', '2026-05-13', 113, 1, NULL, '2026-05-13 15:30:23+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (20, NULL, '陳恩怡', NULL, 11, 'OPP,OH', NULL, NULL, 'Right', '2005-10-27', '2026-05-13', 113, 1, NULL, '2026-05-13 15:30:41+08', '2026-05-15 13:16:02+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (21, NULL, '蘇語馨', NULL, 20, 'MB', NULL, NULL, 'Right', '2005-11-26', '2026-05-13', 113, 1, NULL, '2026-05-13 15:30:54+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (22, NULL, '鄭育伶', NULL, 21, 'L,OH', NULL, NULL, 'Right', '2006-08-23', '2026-05-13', 113, 1, NULL, '2026-05-13 15:31:10+08', '2026-05-13 15:48:04+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (23, NULL, '吳芊蓉', NULL, 83, 'S', NULL, NULL, 'Right', '2007-02-22', '2026-05-13', 114, 1, NULL, '2026-05-13 15:31:53+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (24, NULL, '蘇靜綸', NULL, 48, 'MB', NULL, NULL, 'Right', '2006-12-18', '2026-05-13', 114, 1, NULL, '2026-05-13 15:32:09+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (25, NULL, '陳羿均', NULL, 39, NULL, NULL, NULL, 'Right', '2005-11-14', '2026-05-13', 114, 1, NULL, '2026-05-13 15:32:21+08', '2026-05-15 10:34:24+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (26, NULL, '林詠晴', NULL, 99, 'OH', NULL, NULL, 'Right', NULL, '2026-05-13', 112, 1, NULL, '2026-05-13 15:51:25+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (27, NULL, '黃思瑜', NULL, 4, 'OH', NULL, NULL, 'Right', '2002-01-15', '2026-05-13', 109, 1, NULL, '2026-05-13 15:52:29+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (28, NULL, '林芝樂', NULL, 8, 'MB', NULL, NULL, 'Right', '2001-03-14', '2026-05-13', 109, 1, NULL, '2026-05-13 15:52:42+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (29, NULL, '林奕君', NULL, 20, 'S', NULL, NULL, 'Right', '2001-05-21', '2026-05-13', 109, 1, NULL, '2026-05-13 15:52:56+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (30, NULL, '李信柔', NULL, 24, NULL, NULL, NULL, 'Right', NULL, '2026-05-13', 114, 1, NULL, '2026-05-13 15:59:06+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (31, NULL, '黃聆軒', NULL, 30, NULL, NULL, NULL, 'Right', NULL, '2026-05-13', 114, 1, NULL, '2026-05-13 15:59:20+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (32, NULL, '江瑜潔', NULL, 77, NULL, NULL, NULL, 'Right', NULL, '2026-05-13', 114, 1, NULL, '2026-05-13 15:59:36+08', '2026-05-15 18:46:07+08', NULL, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (33, NULL, '石若筠', NULL, 5, 'OH', NULL, NULL, 'Right', '2001-02-18', '2026-05-13', 108, 0, NULL, '2026-05-13 16:02:59+08', '2026-05-13 16:03:11+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (34, NULL, '許舒涵', NULL, 2, 'OPP', NULL, NULL, 'Left', '1999-07-12', '2026-05-13', 107, 0, NULL, '2026-05-13 16:05:58+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (35, NULL, '方卓媛', NULL, 12, 'OH', NULL, NULL, 'Right', '1998-11-24', '2026-05-13', 107, 0, NULL, '2026-05-13 16:06:14+08', '2026-05-13 16:07:47+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (36, NULL, '王貞婷', NULL, 9, 'MB', NULL, NULL, 'Right', '2000-04-11', '2026-05-13', 107, 0, NULL, '2026-05-13 16:06:27+08', '2026-05-13 16:07:32+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (37, NULL, '莊凱婷', NULL, 10, 'S', NULL, NULL, 'Right', '1999-08-08', '2026-05-13', 106, 0, NULL, '2026-05-13 16:06:48+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (38, NULL, '張欣瑜', NULL, 7, 'MB', NULL, NULL, 'Right', '1999-02-25', '2026-05-13', 106, 0, NULL, '2026-05-13 16:07:03+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (39, NULL, '陳怡絢', NULL, 19, 'OH,L', NULL, NULL, 'Right', '1997-12-15', '2026-05-13', 106, 0, NULL, '2026-05-13 16:07:20+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Players" ("Id", "UserId", "Name", "Nickname", "JerseyNo", "Position", "HeightCm", "WeightKg", "DominantHand", "BirthDate", "JoinedAt", "Grade", "IsActive", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (2, NULL, '易廷耘', NULL, 1, 'MB', NULL, NULL, 'Right', '2004-01-24', '2026-05-13', 112, 1, NULL, '2026-05-13 14:41:02+08', '2026-05-18 09:17:58.478545+08', NULL, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: MatchEventPlayers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 3, '2026-05-15 09:45:31+08', NULL, '王亭之', 2, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 6, '2026-05-15 09:45:31+08', NULL, '陳佑珊', 6, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 9, '2026-05-15 09:45:31+08', NULL, '潘鍾郁晨', 12, 'OH,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 10, '2026-05-15 09:45:31+08', NULL, '邱彥聆', 3, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 11, '2026-05-15 09:45:31+08', NULL, '陳尚苓', 7, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 12, '2026-05-15 09:45:31+08', NULL, '劉新庭', 19, 'L,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 14, '2026-05-15 09:45:31+08', NULL, '鄭瑾筠', 15, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 18, '2026-05-15 09:45:31+08', NULL, '王薇筑', 5, 'OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 19, '2026-05-15 09:45:31+08', NULL, '黃宜潔', 10, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (1, 22, '2026-05-15 09:45:31+08', NULL, '鄭育伶', 21, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 3, '2026-05-15 09:49:20+08', NULL, '王亭之', 2, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 6, '2026-05-15 09:49:20+08', NULL, '陳佑珊', 6, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 9, '2026-05-15 09:49:20+08', NULL, '潘鍾郁晨', 12, 'OH,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 10, '2026-05-15 09:49:20+08', NULL, '邱彥聆', 3, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 11, '2026-05-15 09:49:20+08', NULL, '陳尚苓', 7, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 12, '2026-05-15 09:49:20+08', NULL, '劉新庭', 19, 'L,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 13, '2026-05-15 09:49:20+08', NULL, '謝欣晏', 13, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 14, '2026-05-15 09:49:20+08', NULL, '鄭瑾筠', 15, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 16, '2026-05-15 09:49:20+08', NULL, '湯宓璇', 18, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 19, '2026-05-15 09:49:20+08', NULL, '黃宜潔', 10, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 20, '2026-05-15 09:49:20+08', NULL, '陳恩怡', 11, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 22, '2026-05-15 09:49:20+08', NULL, '鄭育伶', 21, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 27, '2026-05-15 09:49:20+08', NULL, '黃思瑜', 4, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 28, '2026-05-15 09:49:20+08', NULL, '林芝樂', 8, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (2, 29, '2026-05-15 09:49:20+08', NULL, '林奕君', 20, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 3, '2026-05-15 09:52:15+08', NULL, '王亭之', 2, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 6, '2026-05-15 09:52:15+08', NULL, '陳佑珊', 6, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 9, '2026-05-15 09:52:15+08', NULL, '潘鍾郁晨', 12, 'OH,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 10, '2026-05-15 09:52:15+08', NULL, '邱彥聆', 3, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 11, '2026-05-15 09:52:15+08', NULL, '陳尚苓', 7, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 12, '2026-05-15 09:52:15+08', NULL, '劉新庭', 19, 'L,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 13, '2026-05-15 09:52:15+08', NULL, '謝欣晏', 13, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 14, '2026-05-15 09:52:15+08', NULL, '鄭瑾筠', 15, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 16, '2026-05-15 09:52:15+08', NULL, '湯宓璇', 18, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 17, '2026-05-15 09:52:15+08', NULL, '林芯葦', 4, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 19, '2026-05-15 09:52:15+08', NULL, '黃宜潔', 10, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 20, '2026-05-15 09:52:15+08', NULL, '陳恩怡', 11, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 22, '2026-05-15 09:52:15+08', NULL, '鄭育伶', 21, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 27, '2026-05-15 09:52:15+08', NULL, '黃思瑜', 4, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 28, '2026-05-15 09:52:15+08', NULL, '林芝樂', 8, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (3, 29, '2026-05-15 09:52:15+08', NULL, '林奕君', 20, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 3, '2026-05-15 09:54:07+08', NULL, '王亭之', 2, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 6, '2026-05-15 09:54:07+08', NULL, '陳佑珊', 6, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 7, '2026-05-15 09:54:07+08', NULL, '林晏慈', 9, 'OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 9, '2026-05-15 09:54:07+08', NULL, '潘鍾郁晨', 12, 'OH,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 10, '2026-05-15 09:54:07+08', NULL, '邱彥聆', 3, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 11, '2026-05-15 09:54:07+08', NULL, '陳尚苓', 7, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 12, '2026-05-15 09:54:07+08', NULL, '劉新庭', 19, 'L,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 14, '2026-05-15 09:54:07+08', NULL, '鄭瑾筠', 15, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 15, '2026-05-15 09:54:07+08', NULL, '蔡孟潔', 16, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 19, '2026-05-15 09:54:07+08', NULL, '黃宜潔', 10, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 21, '2026-05-15 09:54:07+08', NULL, '蘇語馨', 20, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 22, '2026-05-15 09:54:07+08', NULL, '鄭育伶', 21, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (4, 28, '2026-05-15 09:54:07+08', NULL, '林芝樂', 8, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 2, '2026-05-15 13:53:50+08', 'B', '易廷耘', 1, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 3, '2026-05-15 13:53:50+08', 'B', '王亭之', 2, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 6, '2026-05-15 13:53:50+08', 'B', '陳佑珊', 6, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 7, '2026-05-15 13:53:50+08', 'B', '林晏慈', 9, 'OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 9, '2026-05-15 13:53:50+08', 'A', '潘鍾郁晨', 12, 'OH,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 10, '2026-05-15 13:53:50+08', 'A', '邱彥聆', 3, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 11, '2026-05-15 13:53:50+08', 'A', '陳尚苓', 7, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 12, '2026-05-15 13:53:50+08', 'A', '劉新庭', 19, 'L,OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 13, '2026-05-15 13:53:50+08', 'A', '謝欣晏', 13, 'S') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 14, '2026-05-15 13:53:50+08', 'B', '鄭瑾筠', 15, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 15, '2026-05-15 13:53:50+08', 'B', '蔡孟潔', 16, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 16, '2026-05-15 13:53:50+08', 'A', '湯宓璇', 18, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 17, '2026-05-15 13:53:50+08', 'A', '林芯葦', 4, 'OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 18, '2026-05-15 14:00:20+08', 'A', '王薇筑', 5, 'OPP') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 19, '2026-05-15 13:53:50+08', 'A', '黃宜潔', 10, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 20, '2026-05-15 13:53:50+08', 'A', '陳恩怡', 11, 'OPP,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 21, '2026-05-15 13:53:50+08', 'B', '蘇語馨', 20, 'MB') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 22, '2026-05-15 13:53:50+08', 'B', '鄭育伶', 21, 'L,OH') ON CONFLICT DO NOTHING;
INSERT INTO public."MatchEventPlayers" ("MatchEventId", "PlayerId", "CreatedAt", "OurSquad", "PlayerName", "JerseyNo", "Position") VALUES (5, 26, '2026-05-15 13:53:50+08', 'B', '林詠晴', 99, 'OH') ON CONFLICT DO NOTHING;


--
-- Data for Name: MatchLogs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (26, 1, '藥學B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:45:31+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (27, 1, '藥學A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 1, 'W', '2026-05-15 09:45:31+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (28, 1, '心理', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:45:31+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (29, 2, '運醫A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:49:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (30, 2, '公衛', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:49:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (31, 3, '中山醫學B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:52:15+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (32, 3, '慈濟醫學', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:52:15+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (33, 3, '長庚醫學', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 09:52:15+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (34, 3, '長庚中醫', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 2, 'L', '2026-05-15 09:52:15+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (35, 4, '高科財稅', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'W', '2026-05-15 09:54:07+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (36, 4, '高科行銷', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'W', '2026-05-15 09:54:07+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (37, 4, '高科風管', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'W', '2026-05-15 09:54:07+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (38, 4, '高科校隊', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'L', '2026-05-15 09:54:07+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (39, 4, '高科運籌', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'D', '2026-05-15 09:54:07+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (40, 5, '護理B', 'B', NULL, NULL, NULL, NULL, NULL, NULL, 1, 2, 'L', '2026-05-15 14:00:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (41, 5, '生物A', 'A', NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 14:00:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (42, 5, '口衛A', 'A', NULL, NULL, NULL, NULL, NULL, NULL, 2, 1, 'W', '2026-05-15 14:00:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (43, 5, '心理A', 'A', NULL, NULL, NULL, NULL, NULL, NULL, 2, 0, 'W', '2026-05-15 14:00:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."MatchLogs" ("Id", "MatchEventId", "Opponent", "OurSquad", "Set1Our", "Set1Opp", "Set2Our", "Set2Opp", "Set3Our", "Set3Opp", "OurScore", "OpponentScore", "Result", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (44, 5, '運醫B', 'A', NULL, NULL, NULL, NULL, NULL, NULL, 1, 2, 'L', '2026-05-15 14:00:20+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: TrainingSessions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."TrainingSessions" ("Id", "SessionDate", "StartTime", "DurationMin", "Location", "Theme", "CoachUserId", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (5, '2026-05-12', NULL, NULL, '新興高中', NULL, 2, NULL, '2026-05-14 10:35:10+08', '2026-05-14 14:07:46+08', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."TrainingSessions" ("Id", "SessionDate", "StartTime", "DurationMin", "Location", "Theme", "CoachUserId", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (6, '2026-05-09', NULL, NULL, '高醫', NULL, 2, NULL, '2026-05-14 14:47:26+08', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."TrainingSessions" ("Id", "SessionDate", "StartTime", "DurationMin", "Location", "Theme", "CoachUserId", "Notes", "CreatedAt", "UpdatedAt", "CreatedByUserId", "UpdatedByUserId") VALUES (7, '2026-05-16', NULL, NULL, '高醫', NULL, 2, NULL, '2026-05-17 13:43:16+08', NULL, 2, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: SessionDrills; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 1, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 2, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 3, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 4, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 8, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 10, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 11, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 13, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 17, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 18, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 19, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 20, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 21, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (5, 22, '2026-05-14 14:07:46+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 4, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 5, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 10, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 11, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 13, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 14, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 16, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 18, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 19, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 20, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 21, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (6, 22, '2026-05-14 14:47:26+08', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 1, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 2, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 3, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 4, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 8, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 10, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 11, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 13, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;
INSERT INTO public."SessionDrills" ("SessionId", "DrillId", "CreatedAt", "CreatedByUserId") VALUES (7, 18, '2026-05-18 09:17:25.938745+08', 2) ON CONFLICT DO NOTHING;


--
-- Name: AuditDeletes_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AuditDeletes_Id_seq"', 46, true);


--
-- Name: Drills_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Drills_Id_seq"', 22, true);


--
-- Name: MatchEvents_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."MatchEvents_Id_seq"', 5, true);


--
-- Name: MatchLogs_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."MatchLogs_Id_seq"', 44, true);


--
-- Name: Players_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Players_Id_seq"', 39, true);


--
-- Name: Roles_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Roles_Id_seq"', 6, true);


--
-- Name: TrainingSessions_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."TrainingSessions_Id_seq"', 7, true);


--
-- Name: Users_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Users_Id_seq"', 3, true);


-- 還原正常的外鍵/觸發器檢查
SET session_replication_role = DEFAULT;

--
-- PostgreSQL database dump complete
--

