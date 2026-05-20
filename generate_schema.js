const fs = require('fs');

const schemaContent = `const mongoose = require('mongoose');

const nqocSurveySubmissionSchema = new mongoose.Schema({
    // 第一部分 企业基本信息
    e1_orgName: { type: String, required: true },
    e2_industry: { type: String, required: true },
    e3_orgNature: { type: String, required: true },
    e4_employeeCount: { type: String, required: true },
    e5_revenue: { type: String, required: true },
    e6_establishedYears: { type: String, required: true },
    e7_listingStatus: { type: String, required: true },
    e8_aiDeptStatus: { type: String, required: true },

    // 第二部分 填答人信息
    r1_respondentTitle: { type: String, required: true },
    r2_respondentTenure: { type: String, required: true },
    r3_respondentName: { type: String, default: '' },
    r4_respondentContact: { type: String, default: '' },

    // 第三部分 新质组织成熟度评估
    // 维度一 核心价值观
    v1_1_1: { type: Number, const fs = require('fs');

const yp
const schemaContent = `e }
const nqocSurveySubmissionSchema = new mongoose.Schema({
  {     // 第一部分 企业基本信息
    e1_orgName: be    e1_orgName: { type: String, requipe    e2_industry: { type: String, required: true Nu    e3_orgNature: { type: String, required: true r,    e4_employeeCount: { type: String, required: trui    e5_revenue: { type: String, required: true },
    e     e6_establishedYears: { type: String, require

    e7_listingStatus: { type: String, required: true },
  r    e8_aiDeptStatus: { type: String, required: true }, t
    // 第二部分 填答人信息
    r1_responden       r1_respondentTitle: { type: St t    r2_respondentTenure: { type: String, required: true  b    r3_respondentName: { type: String, default: '' },
   pe    r4_respondentContact: { type: String, default: 'er
    // 第三部分 新质组织成熟度评估
    //d:     // 维度一 核心价值观
    v1_1_ed: tr    v1_1_1: { type: Number, conr,
const yp
const schemaContent = `e }
const nqocSurveredconst s},const nqocSurveySubmissioer  {     // 第一部分 企业基本信息
    e1_orgNad:    e1_orgName: be    e1_orgName: { type:      e     e6_establishedYears: { type: String, require

    e7_listingStatus: { type: String, required: true },
  r    e8_aiDeptStatus: { type: String, required: true }, t
    // 第二部分 填?red: true },
    p3_3_1: { type: Number, required: true },
   
    e7_listingStatus: { type: String, requir  p3_4_1: {  r    e8_aiDeptStatus: { type: String, required: trueum    // 第二部分 填答人信息
    r1_responden      d:    r1_responden       r1_responder,   pe    r4_respondentContact: { type: String, default: 'er
    // 第三部分 新质组织成熟度评估
    //d:     // 维度一 核心价值观
    v1_1_ed: o1:     // 第三部分 新质组织成熟度评估
    //d:  1_    //d:     // 维度一 核心价?   m4_1_2:    v1_1_ed: tr    v1_1_1: { type: Numbe4_const yp
const schemaContent = `e }
const nqocS_2const se:const nqocSurveredconst s,
    e1_orgNad:    e1_orgName: be    e1_orgName: { type:      e     e6_establishedYears: { type: m
    e7_listingStatus: { type: String, required: true },
  r    e8_aiDeptStatus: { type: String, required: truber  required: true },
    m4_5_2: { type: Number, required    // 第二部分 填?red: true },
    p3_3_1: { type:      p3_3_1: { type: Number, required:e    
    e7_listingStatus: { type: String, ree },
     r1_responden      d:    r1_responden       r1_responder,   pe    r4_respondentContact: { type: String, default: 'er
    // 第三部分 新?     // 第三部分 新质组织成熟度评估
    //d:     // 维度一 核心价值观
    v1_1_ed: o1:     // 第?m    //d:     // 维度一 核心价值观
    be    v1_1_ed: o1:     // 第三部分 新 N    //d:  1_    //d:     // 维度一 核心价?   m4_1_2:   trconst schemaContent = `e }
const nqocS_2const se:const nqocSurveredconst s,
    e1_orgNad:    e1_org  e5_4_2: {const nqocS_2const se:contr    e1_orgNad:    e1_orgName: be    e1_orgName:e     e7_listingStatus: { type: String, required: true },
  r    e8_aiDeptStatus: { type: String,     r    e8_aiDeptStatus: { type: String, required: trub?   m4_5_2: { type: Number, required    // 第二部分 填?red: true  typ    p3_3_1: { type:      p3_3_1: { type: Number, required:e    
    e7_li s    e7_listingStatus: { type: String, ree },
     r1_respondenyp     r1_responden      d:    r1_responden  ?   // 第三部分 新?     // 第三部分 新质组织成熟度评估
    //d:     // 维度一 核心价值观
        //d:     // 维度一 核心价值观
    v1_1_ed: o1:     // 第?m ??    v1_1_ed: o1:     // 第?m    //d:  or    be    v1_1_ed: o1:     // 第三部分 新 N    //d:  1_    //d:  .econst nqocS_2const se:const nqocSurveredconst s,
    e1_orgNad:    e1_org  e5_4_2: {const nqocS_2const se:contr    e1_orgNad:    e1_orgNamontent);
console.log("Schema generated.");
