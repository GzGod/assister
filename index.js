import fetch from 'node-fetch';
import fs from 'fs';
import bs58 from 'bs58';
import * as solanaWeb3 from '@solana/web3.js';
import nacl from 'tweetnacl';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';

const ACCOUNTS_PATH = './accounts.txt';
const PROXY_PATH = './proxies.txt';

// 日志记录函数
const log = (pubKey, message, type = 'info') => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, ' ').slice(0, 19);
    const colors = {
        success: chalk.green,
        error: chalk.red,
        warning: chalk.yellow,
        system: chalk.cyan,
        info: chalk.magenta
    };
    const messageColor = colors[type] || colors.info;
    const pubKeyColor = chalk.yellow;

    if (type === 'system') {
        console.log(
            chalk.white('[') + 
            chalk.gray(timestamp) + 
            chalk.white('] ') + 
            messageColor(message)
        );
    } else {
        if (message.startsWith('处理中') && pubKey && pubKey !== 'UNKNOWN') {
            console.log(
                chalk.white('[') + 
                chalk.gray(timestamp) + 
                chalk.white('] ') + 
                messageColor('处理中 ') + 
                pubKeyColor(pubKey)
            );
        } else {
            console.log(
                chalk.white('[') + 
                chalk.gray(timestamp) + 
                chalk.white('] ') + 
                messageColor(message)
            );
        }
    }
};

// 读取账户信息
const readAccounts = () => {
    try {
        const data = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
        return data.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [token, refreshToken, privateKey] = line.split(':');
                return { token, refreshToken, privateKey };
            });
    } catch (error) {
        log('系统', `读取账户时出错: ${error.message}`, 'error');
        return [];
    }
};

// 读取代理列表
const readProxy = () => {
    try {
        const data = fs.readFileSync(PROXY_PATH, 'utf8');
        return data.split('\n').filter(line => line.trim());
    } catch {
        return [];
    }
};

// 更新账户文件
const updateAccountFile = (accounts) => {
    const content = accounts.map(acc => 
        `${acc.token}:${acc.refreshToken}:${acc.privateKey}`
    ).join('\n');
    fs.writeFileSync(ACCOUNTS_PATH, content);
};

// 从私钥获取公钥
const getPublicKey = (privateKey) => {
    if (!privateKey) return 'UNKNOWN';
    try {
        const cleanPrivateKey = privateKey.trim();
        const keypair = solanaWeb3.Keypair.fromSecretKey(bs58.decode(cleanPrivateKey));
        return keypair.publicKey.toString();
    } catch (error) {
        console.error(`解码私钥时出错: ${error.message}`);
        return 'UNKNOWN';
    }
};

// 自定义fetch函数，支持代理
const customFetch = (proxy) => {
    return async (url, options = {}) => {
        if (proxy) {
            const agent = new HttpsProxyAgent(proxy);
            options.agent = agent;
        }
        return fetch(url, {
            ...options,
            headers: {
                'accept': 'application/json',
                'origin': 'https://build.assisterr.ai',
                'referer': 'https://build.assisterr.ai/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...options.headers
            }
        });
    };
};

// 获取登录消息
const getLoginMessage = async (fetchFn) => {
    const response = await fetchFn('https://api.assisterr.ai/incentive/auth/login/get_message/');
    return response.text();
};

// 签名登录消息
const signLoginMessage = (message, privateKey) => {
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);
    const keypair = solanaWeb3.Keypair.fromSecretKey(bs58.decode(privateKey));
    return {
        signature: bs58.encode(nacl.sign.detached(encodedMessage, keypair.secretKey)),
        publicKey: keypair.publicKey.toString()
    };
};

// 处理登录
const handleLogin = async (fetchFn, message, privateKey) => {
    const { signature, publicKey } = signLoginMessage(message, privateKey);
    const response = await fetchFn('https://api.assisterr.ai/incentive/auth/login/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, signature, key: publicKey })
    });
    return response.json();
};

// 处理令牌刷新
const handleTokenRefresh = async (fetchFn, refreshToken) => {
    const response = await fetchFn('https://api.assisterr.ai/incentive/auth/refresh_token/', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${refreshToken}` }
    });
    return response.json();
};

// 领取每日奖励
const claimDaily = async (fetchFn, token) => {
    const response = await fetchFn('https://api.assisterr.ai/incentive/users/me/daily_points/', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${token}` }
    });
    return response.json();
};

// 检查用户状态
const checkUserStatus = async (fetchFn, token) => {
    const response = await fetchFn('https://api.assisterr.ai/incentive/users/me/', {
        headers: { 'authorization': `Bearer ${token}` }
    });
    return response.json();
};

// 获取用户元数据
const getUserMeta = async (fetchFn, token) => {
    const response = await fetchFn('https://api.assisterr.ai/incentive/users/me/meta/', {
        headers: { 'authorization': `Bearer ${token}` }
    });
    return response.json();
};

// 处理单个账户
const processAccount = async (account, proxy) => {
    const fetchWithProxy = customFetch(proxy);
    const publicKey = getPublicKey(account.privateKey);
    
    try {
        let currentAccount = { ...account };
        log(publicKey, '处理中', 'info');
        
        let userStatus = await checkUserStatus(fetchWithProxy, currentAccount.token);

        if (!userStatus?.id) {
            log('', '令牌已过期，尝试刷新...', 'info');
            const refreshResult = await handleTokenRefresh(fetchWithProxy, currentAccount.refreshToken);
            
            if (refreshResult?.access_token) {
                currentAccount.token = refreshResult.access_token;
                currentAccount.refreshToken = refreshResult.refresh_token;
                log('', '令牌刷新成功', 'success');
                userStatus = await checkUserStatus(fetchWithProxy, currentAccount.token);
            } else {
                log('', '令牌刷新失败，尝试新登录...', 'warning');
                const message = await getLoginMessage(fetchWithProxy);
                const loginResult = await handleLogin(fetchWithProxy, message.replace(/['"]/g, ''), currentAccount.privateKey);
                
                if (!loginResult.access_token) {
                    throw new Error('登录失败');
                }
                currentAccount.token = loginResult.access_token;
                currentAccount.refreshToken = loginResult.refresh_token;
                log('', '新登录成功', 'success');
            }
        }

        const meta = await getUserMeta(fetchWithProxy, currentAccount.token);
        if (meta?.daily_points_start_at) {
            const nextClaim = new Date(meta.daily_points_start_at);
            if (nextClaim > new Date()) {
                const timeUntil = Math.ceil((nextClaim - new Date()) / (1000 * 60));
                log('', `下次领取在 ${timeUntil} 分钟后可用`, 'info');
                return currentAccount;
            }
        }

        const claimResult = await claimDaily(fetchWithProxy, currentAccount.token);
        if (claimResult?.points) {
            log('', `领取成功！获得 ${claimResult.points} 点`, 'success');
            const nextClaimTime = new Date(claimResult.daily_points_start_at);
            log('', `下次领取时间: ${nextClaimTime.toLocaleString()}`, 'info');
        } else {
            log('', `领取失败: ${JSON.stringify(claimResult)}`, 'error');
        }

        return currentAccount;
    } catch (error) {
        log('', `错误: ${error.message}`, 'error');
        return account;
    }
};

// 主函数
const main = async () => {
    console.log(chalk.cyan('每日自动领取已启动！\n'));
    
    const accounts = readAccounts();
    const proxies = readProxy();
    
    if (proxies.length > 0) {
        console.log(chalk.yellow(`已加载 ${proxies.length} 个代理`));
    } else {
        console.log(chalk.red('未找到代理，使用直接连接'));
    }
    
    console.log(chalk.magenta(`处理 ${accounts.length} 个账户\n`));
    
    const updatedAccounts = [];

    for (let i = 0; i < accounts.length; i++) {
        const proxy = proxies.length ? proxies[i % proxies.length] : null;
        const updatedAccount = await processAccount(accounts[i], proxy);
        updatedAccounts.push(updatedAccount);
    }

    updateAccountFile(updatedAccounts);
    console.log('\n');  
    log('系统', '所有账户已处理，等待下一个周期...', 'success');
    
    setTimeout(main, 3600000);
};

// 清屏并显示欢迎信息
console.clear();
console.log(chalk.cyan(`
               ╔═╗╔═╦╗─╔╦═══╦═══╦═══╦═══╗
               ╚╗╚╝╔╣║─║║╔══╣╔═╗║╔═╗║╔═╗║
               ─╚╗╔╝║║─║║╚══╣║─╚╣║─║║║─║║
               ─╔╝╚╗║║─║║╔══╣║╔═╣╚═╝║║─║║
               ╔╝╔╗╚╣╚═╝║╚══╣╚╩═║╔═╗║╚═╝║
               ╚═╝╚═╩═══╩═══╩═══╩╝─╚╩═══╝
               我的gihub：github.com/Gzgod
               我的推特：推特雪糕战神@Hy78516012                  
`));
main();
