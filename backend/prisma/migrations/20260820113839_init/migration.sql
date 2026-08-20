-- CreateTable
CREATE TABLE "Pokemon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameZh" TEXT NOT NULL,
    "nameJa" TEXT,
    "nameEn" TEXT,
    "types" TEXT NOT NULL,
    "gen" INTEGER,
    "filter" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "detail" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Pokedex" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameZh" TEXT NOT NULL,
    "nameJa" TEXT,
    "nameEn" TEXT,
    "type" TEXT,
    "category" TEXT,
    "power" TEXT,
    "accuracy" TEXT,
    "pp" TEXT,
    "description" TEXT,
    "generation" INTEGER,
    "isZ" TEXT
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameZh" TEXT NOT NULL,
    "nameJa" TEXT,
    "nameEn" TEXT,
    "description" TEXT,
    "commonCount" INTEGER,
    "hiddenCount" INTEGER,
    "generation" INTEGER
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameZh" TEXT NOT NULL,
    "nameJa" TEXT,
    "nameEn" TEXT,
    "type" TEXT,
    "category" TEXT,
    "description" TEXT,
    "icon" TEXT
);

-- CreateIndex
CREATE INDEX "Pokemon_nameZh_idx" ON "Pokemon"("nameZh");

-- CreateIndex
CREATE INDEX "Pokemon_nameEn_idx" ON "Pokemon"("nameEn");

-- CreateIndex
CREATE INDEX "Pokemon_gen_idx" ON "Pokemon"("gen");

-- CreateIndex
CREATE UNIQUE INDEX "Pokedex_name_key" ON "Pokedex"("name");

-- CreateIndex
CREATE INDEX "Move_nameZh_idx" ON "Move"("nameZh");

-- CreateIndex
CREATE INDEX "Move_type_idx" ON "Move"("type");

-- CreateIndex
CREATE INDEX "Ability_nameZh_idx" ON "Ability"("nameZh");

-- CreateIndex
CREATE INDEX "Item_nameZh_idx" ON "Item"("nameZh");
