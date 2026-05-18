-- =============================================
-- 001_init_auth.sql
-- Users + Roles (custom, not ASP.NET Core Identity)
-- =============================================
IF DB_ID(N'VolleyballTrainingTracker') IS NULL
BEGIN
    CREATE DATABASE VolleyballTrainingTracker;
END
GO

USE VolleyballTrainingTracker;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        UserName        NVARCHAR(64)    NOT NULL,
        Email           NVARCHAR(256)   ,
        PasswordHash    NVARCHAR(256)   NOT NULL,
        Role            NVARCHAR(16)    NOT NULL CONSTRAINT DF_Users_Role DEFAULT (N'Player'),
        DisplayName     NVARCHAR(64)    NULL,
        IsActive        BIT             NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(0)    NULL,
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Users_UserName UNIQUE (UserName),
        CONSTRAINT CK_Users_Role CHECK (Role IN (N'Coach', N'Player'))
    );
END
GO

-- Seed default Coach (password: Coach@123, BCrypt hash placeholder, replace via API in production)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserName = N'coach')
BEGIN
    INSERT INTO dbo.Users (UserName, Email, PasswordHash, Role, DisplayName)
    VALUES (
        N'coach',
        N'coach@example.com',
        N'$2a$11$P3vTcK1RAGSc8O5o2A1l5.TSe.RXBxr.fXvY7G3hH7QHdAhBgKK7G', -- BCrypt of "Coach@123"
        N'Coach',
        N'Default Coach'
    );
END
GO
