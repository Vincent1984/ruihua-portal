const TYPE_LABELS = {
  hr_forum: 'HR领袖活动论坛',
  city_salon: '城市沙龙',
  closed_door: '闭门研讨会'
};

function baseFormSchema() {
  return [
    { key: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入姓名', validation: { minLength: 2, maxLength: 30 }, sort: 1 },
    { key: 'phone', label: '电话', type: 'phone', required: true, placeholder: '请输入手机号', validation: { pattern: '^1[3-9]\\d{9}$', minLength: 11, maxLength: 11 }, sort: 2 },
    { key: 'smsCode', label: '短信验证码', type: 'smsCode', required: true, placeholder: '请输入验证码', validation: { minLength: 4, maxLength: 6 }, sort: 3 },
    { key: 'company', label: '公司名称', type: 'text', required: true, placeholder: '请输入公司名称', validation: { minLength: 2, maxLength: 100 }, sort: 4 },
    { key: 'position', label: '职位', type: 'text', required: true, placeholder: '请输入职位', validation: { minLength: 2, maxLength: 60 }, sort: 5 },
    { key: 'email', label: '邮箱', type: 'email', required: false, placeholder: '请输入邮箱', validation: { maxLength: 120 }, sort: 6 }
  ];
}

function defaultTemplateByType(type) {
  const label = TYPE_LABELS[type] || '活动模板';
  return {
    name: `${label}模板`,
    code: type + '_default',
    activityType: type,
    sceneDescription: `${label}默认报名模板`,
    status: 'enabled',
    formSchema: baseFormSchema(),
    uiConfig: {
      themeName: '科技紫',
      colors: {
        bgStart: '#8b5cff',
        bgEnd: '#6f42ff',
        titleColor: '#ffffff',
        buttonStart: '#8a54ff',
        buttonEnd: '#5a26ff'
      },
      panelOpacity: 0.06,
      backgroundImage: '',
      logoImage: '',
      pageTitle: label,
      activityIntro: '欢迎参加本次活动',
      noticeText: '请准确填写报名信息',
      successRedirect: '',
      successMessage: '报名成功！后续将通过短信/邮件发放参会邀请函。'
    }
  };
}

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length !== 11) return p;
  return p.slice(0, 3) + '****' + p.slice(-4);
}

function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at <= 1) return e;
  return e.slice(0, 1) + '***' + e.slice(at - 1);
}

function validateByFormSchema(formSchema, formData) {
  const errors = [];
  const sorted = [...(formSchema || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  for (const f of sorted) {
    const value = String((formData || {})[f.key] || '').trim();
    if (f.required && !value) {
      errors.push(`${f.label}为必填项`);
      continue;
    }
    if (!value) continue;
    const v = f.validation || {};
    if (v.minLength && value.length < v.minLength) errors.push(`${f.label}长度不足`);
    if (v.maxLength && value.length > v.maxLength) errors.push(`${f.label}长度超限`);
    if (v.pattern) {
      const reg = new RegExp(v.pattern);
      if (!reg.test(value)) errors.push(`${f.label}格式不正确`);
    }
    if (f.type === 'email' && value && !/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(value)) errors.push(`${f.label}格式不正确`);
  }
  return errors;
}

module.exports = {
  TYPE_LABELS,
  defaultTemplateByType,
  validateByFormSchema,
  maskPhone,
  maskEmail
};
