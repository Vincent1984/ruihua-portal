# 预约功能实现说明

## 功能概述

已成功实现预约表单的数据保存和钉钉通知功能，包括：

1. **前端表单提交**：用户填写预约信息并提交
2. **后端数据保存**：将预约信息保存到 MongoDB 数据库
3. **钉钉通知**：自动发送预约信息到指定钉钉群
4. **管理后台**：查看和管理预约信息

## 技术实现

### 1. 数据库模型
```javascript
// Appointment Schema
{
  name: String,        // 姓名
  phone: String,       // 手机号
  company: String,     // 公司名称
  title: String,       // 职位
  problem: String,     // 问题描述
  source: String,      // 来源页面
  createdAt: Date      // 创建时间
}
```

### 2. API 接口

#### 提交预约
- **URL**: `POST /api/appointments`
- **参数**: 
  ```json
  {
    "name": "姓名",
    "company": "公司名称", 
    "title": "职位",
    "phone": "手机号",
    "problem": "问题描述",
    "source": "来源页面"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "message": "预约提交成功，我们会尽快与您联系！",
    "id": "预约ID"
  }
  ```

#### 获取预约列表
- **URL**: `GET /api/appointments`
- **参数**: `page`, `limit`
- **返回**: 分页的预约列表数据

### 3. 钉钉通知

#### 配置方式
在 `.env` 文件中配置：
```bash
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=SECxxx
```

#### 通知内容
发送 Markdown 格式的消息，包含：
- 客户姓名、公司、职位
- 联系电话
- 问题描述
- 提交时间和来源

### 4. 数据验证

#### 前端验证
- 姓名、公司、职位、手机号为必填
- 手机号格式验证（11位中国大陆号码）
- 短信验证码验证（演示环境）

#### 后端验证
- 必填字段检查
- 手机号格式验证
- 数据清理和转换

## 页面文件

### 前端页面
- `public/form1.html` - 预约表单页面
- `public/admin/appointments.html` - 预约管理后台

### 后端文件
- `server.js` - 主服务器文件（包含 API 和钉钉通知）
- `models/Appointment.js` - 数据模型（已存在）

### 配置文件
- `.env` - 环境变量配置
- `k8s/configmap.yaml` - Kubernetes 配置
- `docs/dingtalk-setup.md` - 钉钉配置指南

## 使用流程

### 用户端
1. 访问 `http://localhost:3000/form1.html`
2. 填写基本信息（姓名、公司、职位）
3. 填写联系方式（手机号、验证码）
4. 可选填写问题描述
5. 提交预约

### 管理端
1. 访问 `http://localhost:3000/admin/appointments.html`
2. 查看预约列表和统计信息
3. 可以按时间、公司等维度查看数据

### 钉钉通知
1. 用户提交预约后自动触发
2. 发送包含完整预约信息的消息
3. 提醒相关人员及时跟进

## 测试验证

### API 测试
```bash
# 提交预约
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"name":"测试用户","company":"测试公司","title":"CEO","phone":"13800138000","problem":"测试问题","source":"form1.html"}'

# 获取预约列表  
curl http://localhost:3000/api/appointments
```

### 功能测试
- ✅ 表单提交成功
- ✅ 数据保存到数据库
- ✅ 钉钉通知发送（需配置真实 Webhook）
- ✅ 管理后台显示数据
- ✅ 数据验证正常

## 部署说明

### 本地部署
1. 配置 `.env` 文件中的钉钉参数
2. 启动服务：`npm start`
3. 访问表单页面测试

### Kubernetes 部署
1. 更新 `k8s/configmap.yaml` 中的钉钉配置
2. 部署：`kubectl apply -k k8s/`
3. 配置 Ingress 或 Service 访问

## 安全考虑

1. **数据验证**：前后端双重验证
2. **敏感信息**：钉钉密钥等通过环境变量配置
3. **访问控制**：管理后台需要登录验证
4. **数据保护**：客户信息安全存储

## 扩展功能

可以进一步扩展的功能：
- 预约状态管理（待处理、已联系、已完成）
- 邮件通知功能
- 预约数据导出
- 客户跟进记录
- 预约统计分析