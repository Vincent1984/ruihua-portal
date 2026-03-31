const { defaultTemplateByType, validateByFormSchema, maskPhone, maskEmail } = require('../utils/activityTemplateUtils');

describe('activity template utils', () => {
  test('default template has base fields', () => {
    const tpl = defaultTemplateByType('hr_forum');
    expect(tpl.activityType).toBe('hr_forum');
    expect(Array.isArray(tpl.formSchema)).toBe(true);
    expect(tpl.formSchema.find(f => f.key === 'smsCode')).toBeTruthy();
  });

  test('validate schema checks required and pattern', () => {
    const schema = [
      { key: 'phone', label: '电话', type: 'phone', required: true, validation: { pattern: '^1[3-9]\\d{9}$', minLength: 11, maxLength: 11 }, sort: 1 }
    ];
    const err1 = validateByFormSchema(schema, {});
    expect(err1.length).toBeGreaterThan(0);
    const err2 = validateByFormSchema(schema, { phone: '123' });
    expect(err2.length).toBeGreaterThan(0);
    const ok = validateByFormSchema(schema, { phone: '13800138000' });
    expect(ok.length).toBe(0);
  });

  test('mask helpers work', () => {
    expect(maskPhone('13800138000')).toBe('138****8000');
    expect(maskEmail('abcde@test.com')).toContain('***');
  });
});
