BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(120) NOT NULL,
    [passwordHash] NVARCHAR(200) NOT NULL,
    [fullName] NVARCHAR(120) NOT NULL,
    [role] NVARCHAR(20) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'CUSTOMER',
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Brand] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(60) NOT NULL,
    CONSTRAINT [Brand_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Brand_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[CpuBenchmark] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pattern] NVARCHAR(80) NOT NULL,
    [displayName] NVARCHAR(120) NOT NULL,
    [rawScore] INT NOT NULL,
    [score] FLOAT(53) NOT NULL,
    [source] NVARCHAR(120) NOT NULL,
    [checkedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CpuBenchmark_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CpuBenchmark_pattern_key] UNIQUE NONCLUSTERED ([pattern])
);

-- CreateTable
CREATE TABLE [dbo].[GpuBenchmark] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pattern] NVARCHAR(80) NOT NULL,
    [displayName] NVARCHAR(120) NOT NULL,
    [rawScore] INT NOT NULL,
    [score] FLOAT(53) NOT NULL,
    [dedicated] BIT NOT NULL,
    [vramGb] INT,
    [source] NVARCHAR(120) NOT NULL,
    [checkedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GpuBenchmark_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GpuBenchmark_pattern_key] UNIQUE NONCLUSTERED ([pattern])
);

-- CreateTable
CREATE TABLE [dbo].[Laptop] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sku] NVARCHAR(80) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [brandId] INT NOT NULL,
    [cpuId] INT NOT NULL,
    [gpuId] INT NOT NULL,
    [ramGb] INT NOT NULL,
    [ramUpgradable] BIT NOT NULL CONSTRAINT [Laptop_ramUpgradable_df] DEFAULT 0,
    [ssdGb] INT NOT NULL,
    [screenInch] FLOAT(53) NOT NULL,
    [resWidth] INT NOT NULL,
    [resHeight] INT NOT NULL,
    [ppi] FLOAT(53) NOT NULL,
    [refreshHz] INT NOT NULL CONSTRAINT [Laptop_refreshHz_df] DEFAULT 60,
    [srgb100] BIT NOT NULL CONSTRAINT [Laptop_srgb100_df] DEFAULT 0,
    [weightKg] FLOAT(53) NOT NULL,
    [batteryWh] FLOAT(53),
    [priceVnd] INT NOT NULL,
    [imageUrl] NVARCHAR(500),
    [sourceUrl] NVARCHAR(500),
    [performanceIdx] FLOAT(53) NOT NULL,
    [valueIdx] FLOAT(53) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Laptop_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Laptop_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Laptop_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Laptop_sku_key] UNIQUE NONCLUSTERED ([sku])
);

-- CreateTable
CREATE TABLE [dbo].[SegmentLabel] (
    [id] INT NOT NULL IDENTITY(1,1),
    [laptopId] INT NOT NULL,
    [segment] NVARCHAR(20) NOT NULL,
    [source] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [confidence] FLOAT(53),
    [predictedBy] NVARCHAR(40),
    [probaJson] NVARCHAR(max),
    [locked] BIT NOT NULL CONSTRAINT [SegmentLabel_locked_df] DEFAULT 0,
    [note] NVARCHAR(500),
    [verifiedById] INT,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SegmentLabel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SegmentLabel_laptopId_key] UNIQUE NONCLUSTERED ([laptopId])
);

-- CreateTable
CREATE TABLE [dbo].[PriceHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [laptopId] INT NOT NULL,
    [priceVnd] INT NOT NULL,
    [changedAt] DATETIME2 NOT NULL CONSTRAINT [PriceHistory_changedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PriceHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ModelVersion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [version] NVARCHAR(40) NOT NULL,
    [type] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [paramsJson] NVARCHAR(max) NOT NULL,
    [metricsJson] NVARCHAR(max) NOT NULL,
    [datasetHash] NVARCHAR(80) NOT NULL,
    [nSamples] INT NOT NULL,
    [trainedAt] DATETIME2 NOT NULL,
    [promotedAt] DATETIME2,
    [promotedById] INT,
    [note] NVARCHAR(500),
    CONSTRAINT [ModelVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ModelVersion_version_key] UNIQUE NONCLUSTERED ([version])
);

-- CreateTable
CREATE TABLE [dbo].[RecommendationSession] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] INT,
    [needJson] NVARCHAR(max) NOT NULL,
    [inferredSegment] NVARCHAR(20),
    [inferredConf] FLOAT(53),
    [usedSegment] NVARCHAR(20) NOT NULL,
    [weightsJson] NVARCHAR(max) NOT NULL,
    [idealJson] NVARCHAR(max) NOT NULL,
    [clfVersion] NVARCHAR(40),
    [isFallback] BIT NOT NULL CONSTRAINT [RecommendationSession_isFallback_df] DEFAULT 0,
    [budgetRelaxed] BIT NOT NULL CONSTRAINT [RecommendationSession_budgetRelaxed_df] DEFAULT 0,
    [latencyMs] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RecommendationSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RecommendationSession_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RecommendationItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sessionId] NVARCHAR(1000) NOT NULL,
    [laptopId] INT NOT NULL,
    [rank] INT NOT NULL,
    [distance] FLOAT(53) NOT NULL,
    [matchPct] FLOAT(53) NOT NULL,
    [isPinned] BIT NOT NULL CONSTRAINT [RecommendationItem_isPinned_df] DEFAULT 0,
    [explanationJson] NVARCHAR(max) NOT NULL,
    CONSTRAINT [RecommendationItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RecommendationItem_sessionId_laptopId_key] UNIQUE NONCLUSTERED ([sessionId],[laptopId])
);

-- CreateTable
CREATE TABLE [dbo].[InteractionEvent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sessionId] NVARCHAR(1000),
    [laptopId] INT NOT NULL,
    [userId] INT,
    [type] NVARCHAR(20) NOT NULL,
    [reason] NVARCHAR(30),
    [note] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InteractionEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InteractionEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Favorite] (
    [userId] INT NOT NULL,
    [laptopId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Favorite_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Favorite_pkey] PRIMARY KEY CLUSTERED ([userId],[laptopId])
);

-- CreateTable
CREATE TABLE [dbo].[LaptopPin] (
    [id] INT NOT NULL IDENTITY(1,1),
    [laptopId] INT NOT NULL,
    [action] NVARCHAR(10) NOT NULL,
    [segment] NVARCHAR(20),
    [reason] NVARCHAR(300) NOT NULL,
    [expiresAt] DATETIME2,
    [createdBy] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LaptopPin_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LaptopPin_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[KnowledgeConfig] (
    [key] NVARCHAR(80) NOT NULL,
    [valueJson] NVARCHAR(max) NOT NULL,
    [updatedBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [KnowledgeConfig_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[AlertLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(40) NOT NULL,
    [severity] NVARCHAR(10) NOT NULL,
    [message] NVARCHAR(500) NOT NULL,
    [value] FLOAT(53),
    [threshold] FLOAT(53),
    [resolved] BIT NOT NULL CONSTRAINT [AlertLog_resolved_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AlertLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AlertLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT,
    [action] NVARCHAR(60) NOT NULL,
    [entity] NVARCHAR(40) NOT NULL,
    [entityId] NVARCHAR(60),
    [detailJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Laptop_priceVnd_idx] ON [dbo].[Laptop]([priceVnd]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Laptop_isActive_idx] ON [dbo].[Laptop]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PriceHistory_laptopId_changedAt_idx] ON [dbo].[PriceHistory]([laptopId], [changedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RecommendationSession_createdAt_idx] ON [dbo].[RecommendationSession]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InteractionEvent_type_createdAt_idx] ON [dbo].[InteractionEvent]([type], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Laptop] ADD CONSTRAINT [Laptop_brandId_fkey] FOREIGN KEY ([brandId]) REFERENCES [dbo].[Brand]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Laptop] ADD CONSTRAINT [Laptop_cpuId_fkey] FOREIGN KEY ([cpuId]) REFERENCES [dbo].[CpuBenchmark]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Laptop] ADD CONSTRAINT [Laptop_gpuId_fkey] FOREIGN KEY ([gpuId]) REFERENCES [dbo].[GpuBenchmark]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SegmentLabel] ADD CONSTRAINT [SegmentLabel_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PriceHistory] ADD CONSTRAINT [PriceHistory_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RecommendationSession] ADD CONSTRAINT [RecommendationSession_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RecommendationItem] ADD CONSTRAINT [RecommendationItem_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[RecommendationSession]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RecommendationItem] ADD CONSTRAINT [RecommendationItem_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InteractionEvent] ADD CONSTRAINT [InteractionEvent_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[RecommendationSession]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InteractionEvent] ADD CONSTRAINT [InteractionEvent_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InteractionEvent] ADD CONSTRAINT [InteractionEvent_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Favorite] ADD CONSTRAINT [Favorite_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Favorite] ADD CONSTRAINT [Favorite_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LaptopPin] ADD CONSTRAINT [LaptopPin_laptopId_fkey] FOREIGN KEY ([laptopId]) REFERENCES [dbo].[Laptop]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
