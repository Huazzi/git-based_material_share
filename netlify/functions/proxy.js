const axios = require('axios');

exports.handler = async function(event, context) {
  // 只允许GET请求
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: '只支持GET请求' };
  }

  try {
    // 从查询参数中获取目标URL
    const { url } = event.queryStringParameters;
    
    if (!url) {
      return { statusCode: 400, body: '缺少url参数' };
    }

    // 检查URL是否来自允许的源（Gitee或GitHub）
    if (!url.startsWith('https://gitee.com/') && !url.startsWith('https://raw.githubusercontent.com/')) {
      return { statusCode: 403, body: '不允许的源URL' };
    }

    // 转发请求到目标URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        // 透传必要的请求头
        'User-Agent': event.headers['user-agent'] || 'Netlify-Proxy'
      }
    });

    // 从目标响应中提取内容类型和其他头部
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // 返回代理的响应
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',  // 允许任何源访问
        'Cache-Control': 'public, max-age=86400' // 缓存1天
      },
      body: response.data.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.log('代理请求错误:', error);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ error: '代理请求失败', message: error.message })
    };
  }
}; 