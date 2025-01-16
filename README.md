# Assisterr 每日自动领取工具
自动领取 assisterr.ai 的每日积分，支持多个账户并使用代理。
前排提示，本人仅作工具分享，使用该脚本默认认可女巫与作者无关。

## 所需环境
1. 注册: [https://build.assisterr.ai](https://build.assisterr.ai/?ref=66654be3b7cbb265d7f7b34e)（连接 Twitter、Discord 并完成任务）
2. 代理（可选）
3. VPS（可选）
4. NodeJS。（必须）

## 账户设置

### 获取token
1. 获取你的 Solana 钱包私钥（用小幽灵或者OKX）
2. 获取账户令牌：
   - 打开 [https://build.assisterr.ai](https://build.assisterr.ai/?ref=66654be3b7cbb265d7f7b34e)，确保你已登录并完成任务。
   - 打开浏览器的开发者工具，按 F12 或 Ctrl+Shift+I，切换到控制台（Console）标签。
   - 运行以下命令：
   ```bash
   function getCookieValue(cookieName) {
       const cookies = document.cookie.split('; ');
       for (let cookie of cookies) {
           const [name, value] = cookie.split('=');
           if (name === cookieName) {
               return decodeURIComponent(value);
           }
       }
       return null
   }
   const accessToken = getCookieValue('accessToken');
   const refreshToken = getCookieValue('refreshToken');
   console.log('Access Token:', accessToken);
   console.log('Refresh Token:', refreshToken);
   ```
   ![image](https://github.com/user-attachments/assets/583142e4-4f92-4bb6-8dd1-cae03b45d71d)

3. 将你的凭证按以下格式插入到 `accounts.txt` 中：
   ```bash
   accessToken:refreshToken:privatekey
   ```
   > 如果你运行多个账户，请逐行插入。

4. 将代理插入到 `proxies.txt` 中，格式如下：
   ```bash
   http://ip:port
   http://user:pass@ip:port
   ```
   > 目前仅支持 HTTP 代理。

## 模块安装
- 使用git
```bash
git clone https://github.com/Gzgod/assister.git
```
- 打开终端并确保你已经在 bot 文件夹中：
```bash
cd assister
```
- 安装模块：
```bash
npm install
```
- 运行脚本：
```bash
node index.js
```
