# iOS 快捷指令打卡方案

不需要打开网页，直接从 iPhone 主屏或小组件一键完成打卡。

---

## 前置准备

### 1. 创建 GitHub Personal Access Token (PAT)

1. 打开 [https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)（Fine-grained tokens）
2. 点击 **Generate new token**
3. Token name：`checkin-shortcut`
4. Expiration：选择你喜欢的过期时间（建议 1 年）
5. Repository access：选择 **Only select repositories** → 选你的 workouts repo
6. Permissions → **Contents**：选 `Read and write`
7. 点击 **Generate token** → 复制保存好 token（只显示一次！）

---

## 快捷指令方案

### 方案 A：一键全部打卡（最简单）

点击后直接把今天三项全部打卡为完成。

**手动创建步骤：**

1. 打开 iPhone「快捷指令」App → 点击右上角 `+`
2. 添加动作 **「文本」**，内容填：
   ```
   YOUR_GITHUB_TOKEN
   ```
   （替换为你的 PAT）

3. 添加动作 **「脚本」→「运行 JavaScript」**，代码如下：

```javascript
const token = inputText // 从上一步「文本」传入

const owner = 'YOUR_USERNAME'    // 替换为你的 GitHub 用户名
const repo = 'YOUR_REPO_NAME'    // 替换为你的 repo 名，如 workouts
const path = 'data/checkins.json'

const today = new Date().toLocaleDateString('sv-SE', {
  timeZone: 'Asia/Shanghai'  // 替换为你的时区
})

const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json'
}

// 读取当前文件
const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers })
const getData = await getRes.json()
const sha = getData.sha
const current = JSON.parse(atob(getData.content.replace(/\n/g, '')))

// 更新今日打卡
const existing = current.checkins.find(c => c.date === today)
if (existing) {
  existing.pushups = true
  existing.squats = true
  existing.coldShower = true
} else {
  current.checkins.push({ date: today, pushups: true, squats: true, coldShower: true })
  current.checkins.sort((a, b) => a.date.localeCompare(b.date))
}

// 写回文件
const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2) + '\n')))
await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    message: `checkin: ${today} all done`,
    content: newContent,
    sha
  })
})

return `✅ ${today} 打卡成功！`
```

4. 添加动作 **「通知」**，显示「运行 JavaScript」的结果
5. 保存快捷指令，命名为「每日打卡」，设置一个好看的图标

---

### 方案 B：选择打卡（灵活）

运行时弹出菜单，选择今天完成了哪几项。

**关键差异**（在方案 A 基础上修改）：

在「运行 JavaScript」前，添加：

1. **「脚本」→「从菜单中选取」**
   - 提示：`今天完成了哪些？`
   - 选项：
     - `💪 俯卧撑`
     - `🏋️ 深蹲`
     - `🚿 冷水澡`
     - `💪🏋️🚿 全部完成`

2. 用「如果」判断各选项，设置对应变量

或者更简单地，使用 **「询问输入」** 动作，每次询问三个是/否问题。

---

### 方案 C：自动化触发（每天早晨提醒）

1. 打开「快捷指令」→ 切换到「自动化」标签页
2. 点击 `+` → **「个人自动化」**
3. 选择 **「一天中的时间」** → 设为 `08:00`
4. 动作：**「运行快捷指令」** → 选择上面的「每日打卡」
5. 关闭「运行前询问」（可选，这样完全静默运行）

---

## 通过 API 直接打卡（高级用户）

如果你熟悉命令行，也可以用 curl：

```bash
#!/bin/bash
OWNER="YOUR_USERNAME"
REPO="YOUR_REPO_NAME"
TOKEN="YOUR_TOKEN"
TODAY=$(date +%Y-%m-%d)

# 读取当前文件
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/data/checkins.json")

SHA=$(echo $RESPONSE | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])")
CONTENT=$(echo $RESPONSE | python3 -c "import json,sys,base64; \
  d=json.load(sys.stdin); \
  print(base64.b64decode(d['content']).decode())")

# 更新内容（Python 脚本）
NEW_CONTENT=$(python3 << EOF
import json, base64

data = json.loads('''$CONTENT''')
today = "$TODAY"

existing = next((c for c in data['checkins'] if c['date'] == today), None)
if existing:
    existing.update({'pushups': True, 'squats': True, 'coldShower': True})
else:
    data['checkins'].append({'date': today, 'pushups': True, 'squats': True, 'coldShower': True})
    data['checkins'].sort(key=lambda x: x['date'])

print(base64.b64encode(json.dumps(data, indent=2).encode()).decode())
EOF
)

# 提交
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/data/checkins.json" \
  -d "{\"message\": \"checkin: $TODAY\", \"content\": \"$NEW_CONTENT\", \"sha\": \"$SHA\"}"

echo "✅ $TODAY 打卡完成"
```

---

## 注意事项

- **时区**：JavaScript 中 `new Date()` 使用设备时区，一般没问题。如果你在境外，注意调整
- **并发冲突**：如果网页端和快捷指令同时打卡，可能出现 `sha` 冲突（409 错误）。此时重试即可
- **Token 安全**：PAT 存在快捷指令的「文本」动作中，不会同步到 iCloud（快捷指令默认不加密）。建议使用权限最小的 Fine-grained token，只给目标 repo 的 Contents 读写权限
- **GitHub Actions**：每次打卡都会产生一个 commit，如果你有自动 CI/CD，注意是否会触发不必要的构建（可以在 commit message 中加 `[skip ci]`）
