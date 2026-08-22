#!/bin/bash
# 部署脚本：本地构建 + 推送到远程仓库触发 Render 部署

set -e

echo "📦 构建前端..."
cd frontend
npm ci
npm run build
echo "✅ 前端构建完成"

echo "📦 构建后端..."
cd ../backend
npm ci
npx prisma generate
npm run build
echo "✅ 后端构建完成"

echo "📝 提交代码..."
cd ..
git add -A
git commit -m "deploy: production build" || true
git push origin master

echo "✅ 推送完成，Render 会自动构建部署"
echo "🌐 访问: https://pokemon-dex.onrender.com"
