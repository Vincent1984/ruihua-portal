const fs = require('fs');

const generateLikert = (id, label) => `
        <div class="mb-4 bg-white/5 p-4 rounded-lg">
            <p class="text-sm text-white mb-4">${id} ${label}</p>
            <div class="likert-scale flex flex-wrap gap-2 md:gap-0">
                <label class="likert-item"><input type="radio" name="${id.toLowerCase().replace(/\./g, '_')}" value="1" required><span>1 (完全不符合)</span></label>
                <label class="likert-item"><input type="radio" name="${id.toLowerCase().replace(/\./g, '_')}" value="2"><span>2 (较不符合)</span></label>
                <label class="likert-item"><input type="radio" name="${id.toLowerCase().replace(/\./g, '_')}" value="3"><span>3 (部分符合)</span></label>
                <label class="likert-item"><input type="radio" name="${id.toLowerCase().replace(/\./g, '_')}" value="4"><span>4 (较为符合)</span></label>
                <label class="likert-item"><input type="radio" name="${id.toLowerCase().replace(/\./g, '_')}" value="5"><span>5 (完全符合)</span></label>
            </div>
        </div>`;

const html = `
                <!-- Progress Bar -->
                <div class="mb-12 max-w-3xl mx-auto relative pt-4">
                    <!-- Track Background -->
                    <div class="absolute top-[2.5rem] left-[12.5%] w-[75%] h-1.5 bg-white/5 rounded-full z-0"></div>
                    <!-- Track Active -->
                    <div id="progress-line" class="absolute top-[2.5rem] left-[12.5%] w-[0%] h-1.5 bg-gradient-to-r from-[var(--nqoc-accent-cyan)] to-[var(--nqoc-brand)] rounded-full transition-all duration-500 ease-out z-0 shadow-[0_0_10px_rgba(0,240,255,0.5)]"></div>
                    
                    <div class="flex justify-between items-start relative z-10">
                        <div class="flex flex-col items-center step-indicator active gap-4 w-1/4 text-center" id="step1-indicator">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--nqoc-brand-light)] to-[var(--nqoc-brand)] text-white font-bold flex items-center justify-center shadow-[0_0_20px_rgba(124,77,255,0.5)] transform rotate-45 transition-all duration-300 border-4 border-[#07090f]">
                                <span class="transform -rotate-45 text-lg">1</span>
                            </div>
                            <span class="text-xs md:text-sm font-bold text-[var(--nqoc-brand-light)] tracking-widest transition-all duration-300">企业信息</span>
                        </div>
                        <div class="flex flex-col items-center step-indicator gap-4 w-1/4 text-center" id="step2-indicator">
                            <div class="w-12 h-12 rounded-2xl bg-[#111424] border-2 border-white/10 text-slate-500 font-bold flex items-center justify-center transition-all duration-300 transform rotate-45 border-4 border-[#07090f]">
                                <span class="transform -rotate-45 text-lg">2</span>
                            </div>
                            <span class="text-xs md:text-sm font-medium text-slate-500 transition-all duration-300 tracking-widest">填答人信息</span>
                        </div>
                        <div class="flex flex-col items-center step-indicator gap-4 w-1/4 text-center" id="step3-indicator">
                            <div class="w-12 h-12 rounded-2xl bg-[#111424] border-2 border-white/10 text-slate-500 font-bold flex items-center justify-center transition-all duration-300 transform rotate-45 border-4 border-[#07090f]">
                                <span class="transform -rotate-45 text-lg">3</span>
                            </div>
                            <span class="text-xs md:text-sm font-medium text-slate-500 transition-all duration-300 tracking-widest">成熟度评估</span>
                        </div>
                        <div class="flex flex-col items-center step-indicator gap-4 w-1/4 text-center" id="step4-indicator">
                            <div class="w-12 h-12 rounded-2xl bg-[#111424] border-2 border-white/10 text-slate-500 font-bold flex items-center justify-center transition-all duration-300 transform rotate-45 border-4 border-[#07090f]">
                                <span class="transform -rotate-45 text-lg">4</span>
                            </div>
                            <span class="text-xs md:text-sm font-medium text-slate-500 transition-all duration-300 tracking-widest">总体评价</span>
                        </div>
                    </div>
                </div>

                <!-- Form -->
                <form id="survey-form">
                    
                    <!-- Step 1: 企业基本信息 -->
                    <div id="step-1" class="space-y-6">
                        <h3 class="text-2xl font-bold text-white mb-6">第一部分 企业基本信息</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2 md:col-span-2">
                                <label class="block text-sm font-medium text-slate-300">E1. 企业名称 <span class="text-red-500">*</span></label>
                                <input type="text" name="orgName" required class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors placeholder-slate-600" placeholder="请输入完整企业名称">
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E2. 所属行业 <span class="text-red-500">*</span></label>
                                <select name="industry" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="智能制造与装备">智能制造与装备</option>
                                    <option value="高科技/TMT">高科技 / TMT（信息技术、互联网、电子）</option>
                                    <option value="金融/保险/资管">金融 / 保险 / 资管</option>
                                    <option value="央企/大型国企">央企 / 大型国企（综合）</option>
                                    <option value="专精特新/隐形冠军">专精特新 / 隐形冠军</option>
                                    <option value="消费/零售/流通">消费 / 零售 / 流通</option>
                                    <option value="医药/生命科学/医疗">医药 / 生命科学 / 医疗</option>
                                    <option value="能源/化工/材料">能源 / 化工 / 材料</option>
                                    <option value="建筑/房地产/工程">建筑 / 房地产 / 工程</option>
                                    <option value="现代服务业">现代服务业（教育、文创、咨询、物流等）</option>
                                    <option value="其他">其他</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E3. 企业性质 <span class="text-red-500">*</span></label>
                                <select name="orgNature" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="中央企业/央企控股">中央企业 / 央企控股</option>
                                    <option value="地方国有企业">地方国有企业</option>
                                    <option value="民营企业">民营企业</option>
                                    <option value="外商独资企业">外商独资企业</option>
                                    <option value="中外合资企业">中外合资企业</option>
                                    <option value="其他">其他</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E4. 员工总人数 <span class="text-red-500">*</span></label>
                                <select name="employeeCount" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="300人以下">300 人以下</option>
                                    <option value="300-1000人">300–1,000 人</option>
                                    <option value="1001-5000人">1,001–5,000 人</option>
                                    <option value="5001-10000人">5,001–10,000 人</option>
                                    <option value="10001-50000人">10,001–50,000 人</option>
                                    <option value="50000人以上">50,000 人以上</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E5. 上一财年营业收入规模 <span class="text-red-500">*</span></label>
                                <select name="revenue" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="1亿元以下">1 亿元以下</option>
                                    <option value="1-10亿元">1–10 亿元</option>
                                    <option value="10-50亿元">10–50 亿元</option>
                                    <option value="50-100亿元">50–100 亿元</option>
                                    <option value="100-500亿元">100–500 亿元</option>
                                    <option value="500亿元以上">500 亿元以上</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E6. 企业成立年限 <span class="text-red-500">*</span></label>
                                <select name="establishedYears" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="5年以内">5 年以内</option>
                                    <option value="5-10年">5–10 年</option>
                                    <option value="11-20年">11–20 年</option>
                                    <option value="21-50年">21–50 年</option>
                                    <option value="50年以上">50 年以上</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">E7. 上市状态 <span class="text-red-500">*</span></label>
                                <select name="listingStatus" required class="w-full bg-[#111424] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors">
                                    <option value="" disabled selected>请选择</option>
                                    <option value="A股上市">A 股上市</option>
                                    <option value="港股上市">港股上市</option>
                                    <option value="美股上市">美股上市</option>
                                    <option value="其他境外上市">其他境外上市</option>
                                    <option value="拟上市">拟上市（已启动 IPO 流程）</option>
                                    <option value="未上市">未上市</option>
                                </select>
                            </div>
                            <div class="space-y-2 md:col-span-2">
                                <label class="block text-sm font-medium text-slate-300">E8. 贵企业是否已设立专门负责数智化或 AI 转型的部门或岗位？ <span class="text-red-500">*</span></label>
                                <div class="radio-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="radio" name="aiDeptStatus" value="已设立首席数字官/首席AI官" required> 是，已设立首席数字官/首席AI官</label>
                                    <label><input type="radio" name="aiDeptStatus" value="由现有高管兼管"> 是，由现有高管兼管</label>
                                    <label><input type="radio" name="aiDeptStatus" value="已设立专门部门或委员会"> 是，已设立专门部门或委员会</label>
                                    <label><input type="radio" name="aiDeptStatus" value="尚未设立"> 否，尚未设立</label>
                                </div>
                            </div>
                        </div>
                        <div class="pt-6 text-right">
                            <button type="button" class="btn-next btn-primary inline-flex items-center !px-8 !py-3">
                                下一步 <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Step 2: 填答人信息 -->
                    <div id="step-2" class="hidden space-y-6">
                        <h3 class="text-2xl font-bold text-white mb-6">第二部分 填答人信息</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2 md:col-span-2">
                                <label class="block text-sm font-medium text-slate-300">R1. 您在本企业的职务 <span class="text-red-500">*</span></label>
                                <div class="radio-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="radio" name="respondentTitle" value="CEO/总经理/董事长" required> CEO / 总经理 / 董事长</label>
                                    <label><input type="radio" name="respondentTitle" value="CHRO/HRVP/人力资源总监"> CHRO / HRVP / 人力资源总监</label>
                                    <label><input type="radio" name="respondentTitle" value="CTO/CIO/CDO"> CTO / CIO / CDO</label>
                                    <label><input type="radio" name="respondentTitle" value="首席战略官/战略规划负责人"> 首席战略官 / 战略规划负责人</label>
                                    <label><input type="radio" name="respondentTitle" value="首席运营官/业务部门负责人"> 首席运营官 / 业务部门负责人</label>
                                    <label><input type="radio" name="respondentTitle" value="组织发展/数字化转型负责人"> 组织发展 / 数字化转型负责人</label>
                                    <label><input type="radio" name="respondentTitle" value="其他高级管理人员"> 其他高级管理人员</label>
                                </div>
                            </div>
                            <div class="space-y-2 md:col-span-2">
                                <label class="block text-sm font-medium text-slate-300">R2. 您在本企业的任职年限 <span class="text-red-500">*</span></label>
                                <div class="radio-group grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                                    <label><input type="radio" name="respondentTenure" value="1年以内" required> 1 年以内</label>
                                    <label><input type="radio" name="respondentTenure" value="1-3年"> 1–3 年</label>
                                    <label><input type="radio" name="respondentTenure" value="3-5年"> 3–5 年</label>
                                    <label><input type="radio" name="respondentTenure" value="5-10年"> 5–10 年</label>
                                    <label><input type="radio" name="respondentTenure" value="10年以上"> 10 年以上</label>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">R3. 您的姓名</label>
                                <input type="text" name="respondentName" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors placeholder-slate-600" placeholder="选填">
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-300">R4. 联系方式 (手机号)</label>
                                <input type="tel" name="respondentContact" id="surveyPhone" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors placeholder-slate-600" placeholder="选填，用于反馈个性化诊断简报">
                            </div>
                            <!-- SMS Code is conditionally required if phone is filled, will handle in JS -->
                            <div class="space-y-2" id="smsCodeContainer" style="display: none;">
                                <label class="block text-sm font-medium text-slate-300">验证码 <span class="text-red-500">*</span></label>
                                <div class="flex gap-2">
                                    <input type="text" name="smsCode" id="surveySmsCode" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--nqoc-accent-cyan)] transition-colors placeholder-slate-600" placeholder="请输入6位验证码">
                                    <button type="button" id="surveySendCodeBtn" class="bg-[var(--nqoc-brand)] hover:bg-[var(--nqoc-brand-light)] text-white px-4 py-3 rounded-xl transition-colors whitespace-nowrap min-w-[120px]">获取验证码</button>
                                </div>
                            </div>
                        </div>
                        <div class="pt-6 flex justify-between">
                            <button type="button" class="btn-prev px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                                <i class="fas fa-arrow-left mr-2"></i> 上一步
                            </button>
                            <button type="button" class="btn-next btn-primary inline-flex items-center !px-8 !py-3">
                                下一步 <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Step 3: 新质组织成熟度评估 -->
                    <div id="step-3" class="hidden space-y-6">
                        <h3 class="text-2xl font-bold text-white mb-6">第三部分 新质组织成熟度评估</h3>
                        <p class="text-slate-400 text-sm mb-6">本部分共 5 个维度、32 个二级指标，请根据贵企业当前实际情况，在 1–5 之间选择。</p>

                        <div class="form-section">
                            <h4 class="text-lg font-bold text-[var(--nqoc-brand-light)] mb-4">维度一 核心价值观</h4>
                            ${generateLikert('V1.1.1', '我司已在企业战略文件中明确表述面向未来的核心价值观（如绿色、创新、可持续、人机共生等）。')}
                            ${generateLikert('V1.1.2', '我司大多数员工在日常工作中能够体现企业的核心价值观。')}
                            ${generateLikert('V1.2.1', '我司已将绿色低碳目标纳入经营约束。')}
                            ${generateLikert('V1.2.2', '我司在产品设计、生产、运营全链条中系统性地考虑环境影响。')}
                            ${generateLikert('V1.3.1', '我司鼓励员工探索新技术与新方法。')}
                            ${generateLikert('V1.3.2', '我司对员工创新探索过程中的失败有较高的容忍度。')}
                            ${generateLikert('V1.3.3', '我司持续将稳定比例的资源投入研发与创新活动。')}
                            ${generateLikert('V1.4.1', '我司在重大决策中会综合权衡短期收益与长期可持续发展。')}
                            ${generateLikert('V1.4.2', '我司主动对外披露 ESG 或可持续发展报告。')}
                            ${generateLikert('V1.5.1', '我司在 AI 应用中明确倡导“人机协同/共生”的工作方式。')}
                            ${generateLikert('V1.5.2', '我司在引入 AI 与自动化的过程中，主动关注员工的能力转型与发展。')}
                        </div>

                        <div class="form-section">
                            <h4 class="text-lg font-bold text-[var(--nqoc-brand-light)] mb-4">维度二 商业模式</h4>
                            ${generateLikert('B2.1.1', 'AI或数智化是我司向客户提供差异化价值的核心要素。')}
                            ${generateLikert('B2.1.2', '过去三年内，我司已基于AI能力推出过全新的产品或服务。')}
                            ${generateLikert('B2.2.1', '我司从市场选择、价值定位、价值主张设计方面，已经有完备流程，确保时刻贴近客户需求。')}
                            ${generateLikert('B2.2.2', '我司已深度运用AI或数智化技术重塑核心业务的价值创造流程。')}
                            ${generateLikert('B2.2.3', 'AI或数智化已显著提升我司的研发、生产和运营效率。')}
                            ${generateLikert('B2.3.1', '我司能够基于客户数据实现高度个性化的产品或服务交付。')}
                            ${generateLikert('B2.3.2', '我司已与客户建立数智化的实时互动连接。')}
                            ${generateLikert('B2.4.1', '我司正在探索区别于传统一次性交易的新型盈利模式。')}
                            ${generateLikert('B2.4.2', '我司的盈利结构正逐步从一次性产品/项目交付向持续性服务转变。')}
                            ${generateLikert('B2.5.1', '我司已建立明确的数据治理与运营机制。')}
                            ${generateLikert('B2.5.2', '我司能够通过数据相关的产品或服务产生经济价值。')}
                            ${generateLikert('B2.6.1', '我司在核心业务上具备差异化定价能力，能够将独特价值转化为高于行业平均水平的盈利空间。')}
                            ${generateLikert('B2.6.2', '我司具备穿越政策周期与行业风口的长期价值创造能力。')}
                            ${generateLikert('B2.7.1', '我司已将绿色或可持续作为价值主张的组成部分。')}
                            
                            <div class="space-y-2 mt-6 bg-white/5 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-slate-300">【客观题 B-O1】 以下哪些 AI 或数智化形态已被纳入贵司的产品或服务中？（多选）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="checkbox" name="b_o1" value="智能推荐/搜索"> 智能推荐 / 智能搜索</label>
                                    <label><input type="checkbox" name="b_o1" value="自然语言交互/客服"> 自然语言交互 / 智能客服</label>
                                    <label><input type="checkbox" name="b_o1" value="计算机视觉与图像识别"> 计算机视觉与图像识别</label>
                                    <label><input type="checkbox" name="b_o1" value="预测优化与决策算法"> 预测、优化与决策算法</label>
                                    <label><input type="checkbox" name="b_o1" value="生成式AI内容生成"> 生成式 AI 内容生成</label>
                                    <label><input type="checkbox" name="b_o1" value="智能体(Agent)"> 智能体（Agent）</label>
                                    <label><input type="checkbox" name="b_o1" value="行业大模型/垂直大模型"> 行业大模型 / 垂直大模型</label>
                                    <label><input type="checkbox" name="b_o1" value="数字人/虚拟员工/数字孪生"> 数字人 / 虚拟员工 / 数字孪生</label>
                                    <label><input type="checkbox" name="b_o1" value="AI嵌入式硬件产品"> AI 嵌入式硬件产品</label>
                                    <label><input type="checkbox" name="b_o1" value="暂未涉及"> 暂未涉及</label>
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h4 class="text-lg font-bold text-[var(--nqoc-brand-light)] mb-4">维度三 生产方式</h4>
                            ${generateLikert('P3.1.1', 'AI技术已深度嵌入我司的核心生产或服务流程。')}
                            ${generateLikert('P3.1.2', '我司在生产或运营中应用AI的范围正在每年明显扩大。')}
                            ${generateLikert('P3.2.1', '我司在重复性、规则性工作中实现了高比例的自动化或智能化。')}
                            ${generateLikert('P3.2.2', '我司在判断性、创造性工作中已开始系统化引入智能化辅助。')}
                            ${generateLikert('P3.3.1', '我司员工在日常工作中已能熟练使用AI工具协同完成任务。')}
                            ${generateLikert('P3.3.2', '我司已设计明确的人机分工与协作机制。')}
                            ${generateLikert('P3.4.1', '我司核心经营决策主要基于数据与算法支撑。')}
                            ${generateLikert('P3.4.2', '我司各业务线均能实时获取业务决策所需的数据与分析洞察。')}
                            ${generateLikert('P3.5.1', 'AI或数智化已显著缩短我司新产品或新服务的研发与上市周期。')}
                            ${generateLikert('P3.5.2', '我司的创新成果数量持续提升。')}
                            ${generateLikert('P3.6.1', '我司能够快速响应市场变化并灵活调整业务部署。')}
                            ${generateLikert('P3.6.2', '我司具备较强的柔性生产或服务能力，可高效服务小批量定制化需求。')}
                            ${generateLikert('P3.7.1', '我司运用数智化技术降低生产或运营的环境足迹。')}

                            <div class="space-y-2 mt-6 bg-white/5 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-slate-300">【客观题 P-O1】 以下哪些智能化工具或平台已在贵司常态化应用？（多选）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="checkbox" name="p_o1" value="通用大模型类工具"> 通用大模型类工具</label>
                                    <label><input type="checkbox" name="p_o1" value="行业/垂直大模型"> 行业 / 垂直大模型</label>
                                    <label><input type="checkbox" name="p_o1" value="RPA"> RPA（机器人流程自动化）</label>
                                    <label><input type="checkbox" name="p_o1" value="数据中台/AI中台"> 数据中台 / AI 中台</label>
                                    <label><input type="checkbox" name="p_o1" value="低代码/无代码平台"> 低代码 / 无代码开发平台</label>
                                    <label><input type="checkbox" name="p_o1" value="智能体开发部署平台"> 智能体开发与部署平台</label>
                                    <label><input type="checkbox" name="p_o1" value="工业互联网/物联网平台"> 工业互联网 / 物联网平台</label>
                                    <label><input type="checkbox" name="p_o1" value="AIGC内容生成工具"> AIGC 内容生成工具</label>
                                    <label><input type="checkbox" name="p_o1" value="数字人/虚拟员工平台"> 数字人 / 虚拟员工平台</label>
                                    <label><input type="checkbox" name="p_o1" value="AI编程助手/DevOps"> AI 编程助手 / DevOps</label>
                                    <label><input type="checkbox" name="p_o1" value="暂未常态化应用"> 暂未常态化应用</label>
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h4 class="text-lg font-bold text-[var(--nqoc-brand-light)] mb-4">维度四 管理范式</h4>
                            ${generateLikert('M4.1.1', '我司组织形态正在从传统科层制向“平台+敏捷小队”模式演进。')}
                            ${generateLikert('M4.1.2', '我司能够根据任务需要动态组建跨职能项目团队。')}
                            ${generateLikert('M4.2.1', '我司核心管理流程已实现高度数智化。')}
                            ${generateLikert('M4.2.2', '我司管理流程能够根据数据与场景进行自适应调整。')}
                            ${generateLikert('M4.3.1', '我司的组织核心能力已从“个体技能堆叠”转向“人机融合智能”。')}
                            ${generateLikert('M4.3.2', '我司有系统机制将员工的经验与知识沉淀为可复用的组织或AI资产。')}
                            ${generateLikert('M4.4.1', '我司重大决策依托实时数据反馈进行快速迭代。')}
                            ${generateLikert('M4.4.2', '我司一线团队拥有充分的自主判断与行动空间。')}
                            ${generateLikert('M4.5.1', '我司有覆盖各层级员工的AI与数智化能力培养计划。')}
                            ${generateLikert('M4.5.2', '我司已系统性优化人才结构与多元化用工模式，以适应新质组织需要。')}
                            ${generateLikert('M4.5.3', '我司已重新设计岗位边界，完善人才的技能标签，为“任务-技能”匹配做准备。')}
                            ${generateLikert('M4.5.4', '我司的管理者已经适应了从管人向管“AI+人”的能力转变。')}
                            ${generateLikert('M4.6.1', '我司的激励机制能有效鼓励员工提升人效、创造合理利润。')}
                            ${generateLikert('M4.6.2', '我司的激励机制能有效鼓励员工与AI协作。')}
                            ${generateLikert('M4.6.3', '我司绩效评估能够准确反映人机协同环境下员工的真实贡献。')}
                            ${generateLikert('M4.7.1', '我司已将绿色与可持续要求嵌入企业的关键管理机制。')}

                            <div class="space-y-2 mt-6 bg-white/5 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-slate-300">【客观题 M-O1】 过去12个月内，针对AI能力建设采取了以下哪些举措？（多选）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="checkbox" name="m_o1" value="全员AI培训"> 全员 AI 素养 / 通识培训</label>
                                    <label><input type="checkbox" name="m_o1" value="关键岗位AI认证"> 关键岗位 AI 应用能力认证</label>
                                    <label><input type="checkbox" name="m_o1" value="引进AI人才"> 外部引进 AI / 数据科学专业人才</label>
                                    <label><input type="checkbox" name="m_o1" value="设立AI奖金"> 设立 AI 应用创新激励 / 专项奖金</label>
                                    <label><input type="checkbox" name="m_o1" value="调整岗位说明书"> 调整岗位说明书纳入“与AI协作”要求</label>
                                    <label><input type="checkbox" name="m_o1" value="设立AI委员会/部门"> 设立首席 AI 官 / AI 委员会</label>
                                    <label><input type="checkbox" name="m_o1" value="建立内部AI案例库"> 建立内部 AI 应用案例库</label>
                                    <label><input type="checkbox" name="m_o1" value="高管赴外部学习"> 组织高管赴外部学习考察</label>
                                    <label><input type="checkbox" name="m_o1" value="重构组织架构"> 重构组织架构（向平台型转型）</label>
                                    <label><input type="checkbox" name="m_o1" value="暂无系统性举措"> 暂无系统性举措</label>
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h4 class="text-lg font-bold text-[var(--nqoc-brand-light)] mb-4">维度五 生态协同</h4>
                            ${generateLikert('E5.1.1', '我司与上下游核心伙伴的数据与业务流程已实现实时连通。')}
                            ${generateLikert('E5.1.2', '我司与产业链伙伴共同推进AI或数智化转型。')}
                            ${generateLikert('E5.2.1', '我司主动与跨行业、跨领域机构开展合作。')}
                            ${generateLikert('E5.2.2', '过去三年内，我司通过跨界合作产生了实际的业务成果。')}
                            ${generateLikert('E5.3.1', '我司可向外部伙伴开放产品、技术或数据等核心能力。')}
                            ${generateLikert('E5.3.2', '我司的产品或服务可与外部生态实现互联互通。')}
                            ${generateLikert('E5.4.1', '我司主动与客户、合作伙伴或开发者共创新产品或新服务。')}
                            ${generateLikert('E5.4.2', '我司围绕自身核心能力已形成一定规模的伙伴、开发者或用户生态。')}
                            ${generateLikert('E5.5.1', '我司在重大决策中系统性地考虑员工、社区、社会等多方利益。')}
                            ${generateLikert('E5.5.2', '我司与政府、学术机构、行业协会等外部主体建立了稳定的协同关系。')}
                            ${generateLikert('E5.6.1', '我司与产业链伙伴在绿色低碳议题上进行实质性协同。')}

                            <div class="space-y-2 mt-6 bg-white/5 p-4 rounded-lg">
                                <label class="block text-sm font-medium text-slate-300">【客观题 E-O1】 当前已建立的外部生态合作类型包括哪些？（多选）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label><input type="checkbox" name="e_o1" value="上下游产业链合作"> 上下游产业链合作</label>
                                    <label><input type="checkbox" name="e_o1" value="技术生态合作"> 技术生态合作（云、AI厂商等）</label>
                                    <label><input type="checkbox" name="e_o1" value="学研合作"> 学研合作（高校、科研院所）</label>
                                    <label><input type="checkbox" name="e_o1" value="客户共创"> 客户共创（联合实验室等）</label>
                                    <label><input type="checkbox" name="e_o1" value="开发者生态"> 开发者生态（开放API等）</label>
                                    <label><input type="checkbox" name="e_o1" value="跨行业战略联盟"> 跨行业 / 跨界战略联盟</label>
                                    <label><input type="checkbox" name="e_o1" value="政府行业合作"> 政府 / 行业协会合作</label>
                                    <label><input type="checkbox" name="e_o1" value="国际化合作"> 国际化合作（跨境或海外）</label>
                                    <label><input type="checkbox" name="e_o1" value="暂未形成合作"> 暂未形成系统性外部生态合作</label>
                                </div>
                            </div>
                        </div>
                        <div class="pt-6 flex justify-between">
                            <button type="button" class="btn-prev px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                                <i class="fas fa-arrow-left mr-2"></i> 上一步
                            </button>
                            <button type="button" class="btn-next btn-primary inline-flex items-center !px-8 !py-3">
                                下一步 <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Step 4: 总体评价与综合反馈 -->
                    <div id="step-4" class="hidden space-y-6">
                        <h3 class="text-2xl font-bold text-white mb-6">第四部分 总体评价与综合反馈</h3>
                        
                        <div class="space-y-6">
                            <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                <label class="block text-sm font-medium text-slate-300 mb-4">S1. 总体而言，您如何评价贵企业当前的“新质组织”成熟度？ <span class="text-red-500">*</span></label>
                                <div class="radio-group flex flex-col gap-2">
                                    <label><input type="radio" name="s1" value="1" required> 1 — 萌芽期（初）：尚未启动新质组织建设</label>
                                    <label><input type="radio" name="s1" value="2"> 2 — 萌芽期：已有局部探索，未形成体系</label>
                                    <label><input type="radio" name="s1" value="3"> 3 — 成长期：已系统推进，部分维度初见成效</label>
                                    <label><input type="radio" name="s1" value="4"> 4 — 成长期—成熟期：已规模化落地，整体成效显著</label>
                                    <label><input type="radio" name="s1" value="5"> 5 — 成熟期：已形成行业引领的最佳实践</label>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                    <label class="block text-sm font-medium text-slate-300 mb-4">S2. 您认为贵企业当前在新质组织五大维度中，最强的两个是？（限选2项）</label>
                                    <div class="checkbox-group flex flex-col gap-2">
                                        <label><input type="checkbox" name="s2" value="核心价值观"> 核心价值观</label>
                                        <label><input type="checkbox" name="s2" value="商业模式"> 商业模式</label>
                                        <label><input type="checkbox" name="s2" value="生产方式"> 生产方式</label>
                                        <label><input type="checkbox" name="s2" value="管理范式"> 管理范式</label>
                                        <label><input type="checkbox" name="s2" value="生态协同"> 生态协同</label>
                                    </div>
                                </div>

                                <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                    <label class="block text-sm font-medium text-slate-300 mb-4">S3. 您认为贵企业当前在新质组织五大维度中，最薄弱的两个是？（限选2项）</label>
                                    <div class="checkbox-group flex flex-col gap-2">
                                        <label><input type="checkbox" name="s3" value="核心价值观"> 核心价值观</label>
                                        <label><input type="checkbox" name="s3" value="商业模式"> 商业模式</label>
                                        <label><input type="checkbox" name="s3" value="生产方式"> 生产方式</label>
                                        <label><input type="checkbox" name="s3" value="管理范式"> 管理范式</label>
                                        <label><input type="checkbox" name="s3" value="生态协同"> 生态协同</label>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                <label class="block text-sm font-medium text-slate-300 mb-4">S4. 过去 12 个月最显著的进展是？（多选，最多 3 项）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <label><input type="checkbox" name="s4" value="完善价值观"> 完善了 AI 时代的核心价值观与战略共识</label>
                                    <label><input type="checkbox" name="s4" value="推新产品"> 推出了基于 AI 的新产品或新业务</label>
                                    <label><input type="checkbox" name="s4" value="重塑流程"> 大规模重塑了核心业务流程</label>
                                    <label><input type="checkbox" name="s4" value="建数据体系"> 建立了系统化的数据资产与治理体系</label>
                                    <label><input type="checkbox" name="s4" value="AI深度部署"> 实现了 AI 与自动化在生产/运营中的深度部署</label>
                                    <label><input type="checkbox" name="s4" value="提升客户体验"> 提升了客户体验的数智化与个性化水平</label>
                                    <label><input type="checkbox" name="s4" value="平台化转型"> 推动了组织架构向“平台+敏捷小队”转型</label>
                                    <label><input type="checkbox" name="s4" value="人才培养机制"> 建立了系统的 AI 人才培养与认证机制</label>
                                    <label><input type="checkbox" name="s4" value="人机协同机制"> 完成了人机协同机制的设计与试点</label>
                                    <label><input type="checkbox" name="s4" value="升级激励机制"> 升级了与 AI 协作匹配的绩效与激励机制</label>
                                    <label><input type="checkbox" name="s4" value="AI协同生态"> 与产业链或学研伙伴形成了 AI 协同生态</label>
                                    <label><input type="checkbox" name="s4" value="跨界版图"> 拓展了跨界/跨行业的合作版图</label>
                                    <label><input type="checkbox" name="s4" value="平台能力开放"> 实现了平台化能力对外开放</label>
                                    <label><input type="checkbox" name="s4" value="ESG实践"> 完善了 ESG 与可持续发展实践</label>
                                    <label><input type="checkbox" name="s4" value="设首席AI官"> 引进或设立了首席AI官/AI委员会</label>
                                    <label><input type="checkbox" name="s4" value="管理者角色扩展"> 扩展了管理者角色，从“管人”转向“管员工+AI”</label>
                                </div>
                            </div>

                            <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                <label class="block text-sm font-medium text-slate-300 mb-4">S5. 当前面临的最大挑战是？（多选，最多 3 项）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <label><input type="checkbox" name="s5" value="高层共识不足"> 高层共识不足，战略方向尚不清晰</label>
                                    <label><input type="checkbox" name="s5" value="价值观不匹配"> 核心价值观尚未与 AI 时代的要求充分匹配</label>
                                    <label><input type="checkbox" name="s5" value="缺领军人才"> 缺乏 AI 或数智化领军人才</label>
                                    <label><input type="checkbox" name="s5" value="全员素养不足"> 全员 AI 素养与能力不足</label>
                                    <label><input type="checkbox" name="s5" value="数据基础薄弱"> 数据基础薄弱，数据质量不高</label>
                                    <label><input type="checkbox" name="s5" value="流程部署脱节"> 业务流程与 AI 部署之间存在脱节</label>
                                    <label><input type="checkbox" name="s5" value="架构僵化"> 组织架构僵化，难以适应敏捷协作</label>
                                    <label><input type="checkbox" name="s5" value="激励机制不匹配"> 现有绩效与激励机制无法匹配新质组织要求</label>
                                    <label><input type="checkbox" name="s5" value="员工抵触焦虑"> 员工对 AI 存在抵触情绪或转型焦虑</label>
                                    <label><input type="checkbox" name="s5" value="难持续投入"> 投资回报周期长，业绩压力下难以持续投入</label>
                                    <label><input type="checkbox" name="s5" value="缺最佳实践"> 缺乏可参考的最佳实践与方法论</label>
                                    <label><input type="checkbox" name="s5" value="伙伴不成熟"> 外部生态合作伙伴尚不成熟</label>
                                    <label><input type="checkbox" name="s5" value="安全合规风险"> 数据安全、合规或伦理风险</label>
                                    <label><input type="checkbox" name="s5" value="技术仍在演进"> AI 技术本身仍在演进，难以做出长期承诺</label>
                                </div>
                            </div>

                            <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                <label class="block text-sm font-medium text-slate-300 mb-4">S6. 未来 3 年内，贵企业最需要补强的能力或实践是？（多选，最多 3 项）</label>
                                <div class="checkbox-group grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <label><input type="checkbox" name="s6" value="战略顶层设计"> 新质组织战略规划与顶层设计</label>
                                    <label><input type="checkbox" name="s6" value="数据治理体系"> 数据资产化与数据治理体系</label>
                                    <label><input type="checkbox" name="s6" value="业务流程重塑"> 核心业务流程的 AI 重塑</label>
                                    <label><input type="checkbox" name="s6" value="AI应用深度"> AI 技术应用的深度与广度</label>
                                    <label><input type="checkbox" name="s6" value="人机协同机制"> 人机协同机制的设计与落地</label>
                                    <label><input type="checkbox" name="s6" value="敏捷架构改造"> 平台化与敏捷化的组织架构改造</label>
                                    <label><input type="checkbox" name="s6" value="AI能力培养"> 全员 AI 素养与关键岗位 AI 能力培养</label>
                                    <label><input type="checkbox" name="s6" value="绩效激励机制"> 与 AI 协作匹配的绩效与激励机制</label>
                                    <label><input type="checkbox" name="s6" value="创新容错机制"> 创新文化与试错容错机制</label>
                                    <label><input type="checkbox" name="s6" value="数据决策能力"> 数据驱动的决策能力</label>
                                    <label><input type="checkbox" name="s6" value="客户体验重构"> 客户体验的数智化重构</label>
                                    <label><input type="checkbox" name="s6" value="生态共创"> 产业链协同与生态共创</label>
                                    <label><input type="checkbox" name="s6" value="跨界探索"> 跨界合作与新业务空间探索</label>
                                    <label><input type="checkbox" name="s6" value="ESG能力"> ESG 与可持续发展能力</label>
                                    <label><input type="checkbox" name="s6" value="AI伦理治理"> AI 安全、合规与伦理治理能力</label>
                                </div>
                            </div>

                            <div class="bg-white/5 p-6 rounded-xl border border-white/10">
                                <label class="block text-sm font-medium text-slate-300 mb-4">S7. 您是否愿意接受后续的深度访谈？ <span class="text-red-500">*</span></label>
                                <div class="radio-group flex flex-col gap-2">
                                    <label><input type="radio" name="s7" value="愿意" required> 愿意，欢迎联系</label>
                                    <label><input type="radio" name="s7" value="视情况而定"> 视情况而定，请先告知主题</label>
                                    <label><input type="radio" name="s7" value="暂不方便"> 暂不方便</label>
                                </div>
                            </div>

                        </div>
                        
                        <div class="pt-6 flex justify-between">
                            <button type="button" class="btn-prev px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                                <i class="fas fa-arrow-left mr-2"></i> 上一步
                            </button>
                            <button type="submit" id="btn-submit" class="btn-primary inline-flex items-center !px-8 !py-3">
                                提交问卷 <i class="fas fa-paper-plane ml-2"></i>
                            </button>
                        </div>
                    </div>

                </form>
`;

const originalHtml = fs.readFileSync('public/nqoc/survey.html', 'utf8');

const startTag = '<!-- Progress Bar -->';
const endTag = '</form>';

const startIndex = originalHtml.indexOf(startTag);
const endIndex = originalHtml.indexOf(endTag) + endTag.length;

if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not find form block');
}

const newHtml = originalHtml.substring(0, startIndex) + html + originalHtml.substring(endIndex);

fs.writeFileSync('public/nqoc/survey.html', newHtml);
console.log('HTML replaced.');