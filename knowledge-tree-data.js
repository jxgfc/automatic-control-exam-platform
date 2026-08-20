(function (root) {
  "use strict";

  root.ControlKnowledgeTree = {
    resources: {
      mit: {
        title: "MIT OpenCourseWare · Feedback Systems",
        url: "https://ocw.mit.edu/courses/6-302-feedback-systems-spring-2007/",
        description: "反馈、稳定性、根轨迹与频域设计的公开课程资料。"
      },
      libretexts: {
        title: "LibreTexts · Introduction to Control Systems",
        url: "https://eng.libretexts.org/Bookshelves/Industrial_and_Systems_Engineering/Introduction_to_Control_Systems_(Iqbal)",
        description: "覆盖建模、时域、频域、稳定性和状态空间的开放教材。"
      },
      pythonControl: {
        title: "Python Control Systems Library",
        url: "https://python-control.readthedocs.io/en/stable/",
        description: "step_response、root_locus_plot、bode_plot、nyquist_plot、ctrb 与 obsv 等官方文档。"
      },
      scipySignal: {
        title: "SciPy Signal 官方文档",
        url: "https://docs.scipy.org/doc/scipy/reference/signal.html",
        description: "传递函数、状态空间、连续/离散系统与响应分析的官方 API 文档。"
      }
    },
    chapters: [
      {
        id: "fundamentals",
        title: "基础概念",
        description: "先建立反馈、系统分类、性能指标与线性化的统一语言。",
        nodes: [
          {
            id: "fundamentals-feedback",
            title: "反馈、开闭环与系统分类",
            schools: ["828", "861"], type: "简述", tool: "theory", query: "反馈 开环 闭环",
            prerequisites: [], resources: ["libretexts", "mit"],
            overview: "控制系统的核心是根据目标与实际输出之间的关系组织控制作用。考研答题要能从结构、信息流和性能影响三个层面区分开环、闭环与复合控制。",
            objectives: ["区分开环、闭环、反馈和前馈", "说明负反馈对精度、抗扰、带宽和稳定性的影响", "判断线性/非线性、连续/离散、定常/时变系统"],
            keyPoints: ["负反馈以偏差为驱动，不能简单表述为一定使系统稳定。", "前馈依赖可测输入或扰动与模型，反馈负责抑制未知扰动和模型误差。", "线性化模型只在选定工作点附近有效，叠加原理不能直接用于非线性系统。"],
            formulas: [
              { name: "单位负反馈闭环", latex: "\\Phi(s)=\\frac{G(s)}{1+G(s)}", note: "负反馈特征方程为 $1+G(s)=0$。" },
              { name: "灵敏度函数", latex: "S(s)=\\frac{1}{1+L(s)}", note: "$|L|$ 较大时低频扰动与参数摄动影响通常减小。" }
            ],
            method: ["画出比较点、控制器、对象和反馈通道。", "检查输出是否回到比较点；没有输出反馈就是开环。", "从稳态误差、抗扰、响应速度、稳定裕度四方面评价反馈作用。", "遇到非线性系统先说明是否在工作点附近线性化。"],
            pitfalls: ["把负反馈写成无条件提高稳定性。", "只依据是否使用传感器判断开环或闭环，而没有检查反馈信息是否参与控制。"],
            example: {
              problem: "温箱用定时器固定加热 10 分钟，与温度传感器实时调节加热功率，分别属于什么控制？若再按室外温度提前修正功率，属于什么结构？",
              steps: ["定时器不使用实际温度，属于开环控制。", "传感器把实际温度反馈并形成偏差，属于闭环反馈控制。", "室外温度前馈与温度反馈同时存在，构成前馈-反馈复合控制。"],
              answer: "依次为开环、闭环和复合控制。"
            }
          }
        ]
      },
      {
        id: "modeling",
        title: "系统建模",
        description: "从物理规律到微分方程、传递函数、结构图与信号流图。",
        nodes: [
          {
            id: "modeling-differential",
            title: "微分方程与方块图建模",
            schools: ["828", "861"], type: "分析", tool: "modeling", query: "微分方程 建模",
            prerequisites: ["fundamentals-feedback"], resources: ["libretexts", "scipySignal"],
            overview: "建模题先选变量和正方向，再写守恒定律与元件关系。机械、电路、热工系统虽然物理量不同，但都可整理成输入、状态和输出之间的微分方程。",
            objectives: ["由牛顿定律、基尔霍夫定律或守恒关系建立方程", "识别输入、输出、状态和初始条件", "把多方程关系组织成方块图"],
            keyPoints: ["平移机械系统常用 $F=ma$，转动系统用 $T=J\\ddot\\theta$。", "电容电压与电感电流天然具有记忆性，常被选作状态变量。", "建立方程前必须统一力、速度、电流和电压的参考方向。"],
            formulas: [
              { name: "质量-弹簧-阻尼", latex: "m\\ddot x+c\\dot x+kx=F(t)", note: "输入为外力，输出可选位移。" },
              { name: "串联 RLC", latex: "LC\\ddot u_C+RC\\dot u_C+u_C=u(t)", note: "由 KVL 与 $i=C\\dot u_C$ 得到。" }
            ],
            method: ["确定系统边界、输入、输出和正方向。", "逐个元件写本构关系，再写节点或整体守恒方程。", "消去中间变量，整理为输出及其导数在左、输入在右。", "检查每一项量纲并验证静态极限是否合理。"],
            pitfalls: ["阻尼力方向与速度方向相反却写成同号驱动力。", "未说明零初始条件就直接把微分方程写成传递函数。"],
            example: {
              problem: "质量 $m=1$、阻尼 $c=3$、弹簧 $k=2$，外力为 $F(t)$，输出位移为 $x(t)$。建立微分方程。",
              steps: ["取位移正方向与外力相同。", "弹簧力为 $-2x$，阻尼力为 $-3\\dot x$。", "由牛顿第二定律 $F-3\\dot x-2x=\\ddot x$。"],
              answer: "$\\ddot x+3\\dot x+2x=F(t)$。"
            }
          },
          {
            id: "modeling-laplace",
            title: "拉氏变换与传递函数",
            schools: ["828", "861"], type: "计算", tool: "modeling", query: "拉氏变换 传递函数",
            prerequisites: ["modeling-differential"], resources: ["libretexts", "scipySignal"],
            overview: "传递函数是零初始条件下线性定常系统的输入输出模型。它适合串并联化简和频域分析，但不能唯一描述系统内部状态。",
            objectives: ["正确处理导数的拉氏变换与初始条件", "由微分方程求传递函数", "由极点、零点判断系统固有模态"],
            keyPoints: ["传递函数定义必须同时满足线性定常与零初始条件。", "极点是分母根，决定自由响应模态；零点影响输入到输出的组合。", "同一传递函数可以有多种状态空间实现。"],
            formulas: [
              { name: "导数变换", latex: "\\mathcal L\\{\\dot x(t)\\}=sX(s)-x(0^-)", note: "二阶导数还要减去 $s x(0^-)+\\dot x(0^-)$。" },
              { name: "传递函数", latex: "G(s)=\\left.\\frac{Y(s)}{U(s)}\\right|_{x(0)=0}", note: "只描述输入输出关系。" }
            ],
            method: ["对方程两边作拉氏变换。", "求传递函数时令所有初始条件为零。", "把含 $Y(s)$ 的项合并，计算 $Y(s)/U(s)$。", "将分母首项归一化，并给出零极点或时间常数形式。"],
            pitfalls: ["把带初始条件的全响应比值当作传递函数。", "分母没有按降幂排列或漏掉导数对应的 $s$ 次方。"],
            example: {
              problem: "已知 $\\ddot y+3\\dot y+2y=2u$，求零初始条件下的传递函数。",
              steps: ["拉氏变换得 $(s^2+3s+2)Y(s)=2U(s)$。", "两边除以 $U(s)(s^2+3s+2)$。", "分母因式分解为 $(s+1)(s+2)$。"],
              answer: "$G(s)=\\frac{2}{s^2+3s+2}=\\frac{2}{(s+1)(s+2)}$。"
            }
          },
          {
            id: "modeling-blocks",
            title: "典型环节与结构图化简",
            schools: ["828", "861"], type: "计算", tool: "modeling", query: "结构图 化简 典型环节",
            prerequisites: ["modeling-laplace"], resources: ["libretexts", "pythonControl"],
            overview: "结构图化简的本质是保持各变量之间的代数关系不变。串联相乘、并联相加、反馈闭合是三种基本运算，移动比较点和引出点时必须补偿跨越环节。",
            objectives: ["识别比例、积分、惯性、振荡和延迟环节", "完成串联、并联与反馈化简", "正确移动比较点和引出点"],
            keyPoints: ["负反馈闭环分母为 $1+GH$，正反馈为 $1-GH$。", "比较点跨越 $G$ 移动时，旁路信号必须乘或除以 $G$。", "含交叉反馈时应先化简最内层回路。"],
            formulas: [
              { name: "负反馈", latex: "T(s)=\\frac{G(s)}{1+G(s)H(s)}", note: "前向通道为 $G$，反馈通道为 $H$。" },
              { name: "典型二阶环节", latex: "G(s)=\\frac{\\omega_n^2}{s^2+2\\zeta\\omega_ns+\\omega_n^2}", note: "由 $\\zeta$ 与 $\\omega_n$ 描述。" }
            ],
            method: ["标出所有比较点符号与引出点。", "从最内层反馈回路开始使用闭环公式。", "再处理串联相乘和并联相加。", "用极限增益或直接列变量方程复核最终结果。"],
            pitfalls: ["负反馈分母误写成 $1-GH$。", "移动比较点时只移动图形而没有补偿传递环节。"],
            example: {
              problem: "前向通道 $G_1=2/(s+1)$ 与 $G_2=3/(s+2)$ 串联，单位负反馈，求闭环传递函数。",
              steps: ["串联等效为 $G=6/[(s+1)(s+2)]$。", "单位负反馈使用 $T=G/(1+G)$。", "分母为 $(s+1)(s+2)+6=s^2+3s+8$。"],
              answer: "$T(s)=\\frac{6}{s^2+3s+8}$。"
            }
          },
          {
            id: "modeling-mason",
            title: "信号流图与梅逊公式",
            schools: ["861"], type: "计算", tool: "modeling", query: "梅逊公式 信号流图",
            prerequisites: ["modeling-blocks"], resources: ["libretexts"],
            overview: "信号流图用节点表示变量、用有向支路表示增益。梅逊公式直接把所有前向通路和互不接触回路组合为总传递函数。",
            objectives: ["找全前向通路与单回路", "判断回路是否互不接触", "计算 $\\Delta$ 与每条通路的 $\\Delta_k$"],
            keyPoints: ["前向通路不能重复经过同一节点。", "两个回路只要共享一个节点就属于接触回路。", "$\\Delta_k$ 只用与第 $k$ 条前向通路不接触的回路构造。"],
            formulas: [
              { name: "梅逊公式", latex: "T=\\frac{\\sum_k P_k\\Delta_k}{\\Delta}", note: "$P_k$ 为第 $k$ 条前向通路增益。" },
              { name: "图特征式", latex: "\\Delta=1-\\sum L_i+\\sum L_iL_j-\\sum L_iL_jL_m+\\cdots", note: "乘积项中的回路必须两两互不接触。" }
            ],
            method: ["列出所有不重复节点的前向通路并求增益。", "列出所有单回路及其增益。", "组合两两、三三互不接触回路并计算 $\\Delta$。", "逐条前向通路删除接触回路得到 $\\Delta_k$，代入梅逊公式。"],
            pitfalls: ["遗漏由多条支路构成的长回路。", "把不接触支路误当成不接触回路；判断对象应是节点集合。"],
            example: {
              problem: "只有一条前向通路 $P=G_1G_2$，有两个互不接触回路 $L_1=-G_1H_1$、$L_2=-G_2H_2$，且二者都接触前向通路，求总传递函数。",
              steps: ["$\\Delta=1-L_1-L_2+L_1L_2$。", "两个回路均接触前向通路，所以 $\\Delta_1=1$。", "代入 $T=P\\Delta_1/\\Delta$。"],
              answer: "$T=\\frac{G_1G_2}{1+G_1H_1+G_2H_2+G_1G_2H_1H_2}$。"
            }
          }
        ]
      },
      {
        id: "time-domain",
        title: "时域分析",
        description: "围绕稳定性、典型响应、动态指标与高阶近似组织计算。",
        nodes: [
          {
            id: "time-routh",
            title: "稳定条件与劳斯判据",
            schools: ["828", "861"], type: "计算", tool: "routh", query: "劳斯 稳定判据",
            prerequisites: ["modeling-laplace"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "连续线性定常系统渐近稳定当且仅当全部闭环极点位于左半平面。劳斯判据不用求根即可由特征多项式系数判断右半平面根数和参数稳定范围。",
            objectives: ["构造任意阶劳斯表", "由首列符号变化判断右半平面根数", "处理首项为零和整行全零两类特殊情况"],
            keyPoints: ["判据对象是闭环特征多项式，而不是开环分母。", "首列符号变化次数等于右半平面根数。", "整行全零表示存在关于原点对称的根，用辅助多项式求导替换。"],
            formulas: [
              { name: "三阶稳定条件", latex: "a_3s^3+a_2s^2+a_1s+a_0:\quad a_i>0,\\ a_2a_1>a_3a_0", note: "适用于首项已统一为正的三阶多项式。" },
              { name: "劳斯元素", latex: "b_1=\\frac{a_{n-1}a_{n-2}-a_na_{n-3}}{a_{n-1}}", note: "按前两行交叉乘积计算。" }
            ],
            method: ["按降幂补齐缺项，并使最高次系数为正。", "前两行交错填入系数。", "逐行计算并只检查首列符号。", "含参数时把首列同号条件联立求范围，并单独检查边界。"],
            pitfalls: ["系数全为正只是一条必要条件，不是高阶系统的充分条件。", "遇到零行只用小正数替代，漏掉虚轴对称根信息。"],
            example: {
              problem: "判断 $D(s)=s^3+3s^2+2s+K$ 的稳定范围。",
              steps: ["三阶劳斯首列为 $1,3,(6-K)/3,K$。", "稳定要求首列全正。", "得到 $K>0$ 且 $6-K>0$。"],
              answer: "$0<K<6$。"
            }
          },
          {
            id: "time-first",
            title: "一阶系统动态性能",
            schools: ["828", "861"], type: "计算", tool: "second-order", query: "一阶系统 时间常数",
            prerequisites: ["modeling-laplace"], resources: ["libretexts", "pythonControl"],
            overview: "一阶系统只有一个实极点，时间常数决定响应速度。阶跃响应、斜坡响应和脉冲响应都应从标准形式与终值出发快速判断。",
            objectives: ["从传递函数识别增益和时间常数", "计算阶跃响应与调节时间", "理解时间常数的几何和物理意义"],
            keyPoints: ["极点为 $-1/T$，$T$ 越小响应越快。", "单位阶跃在 $t=T$ 时达到最终增量的 $63.2\\%$。", "按 $2\\%$ 误差带，一阶调节时间近似 $4T$。"],
            formulas: [
              { name: "标准形式", latex: "G(s)=\\frac{K}{Ts+1}", note: "直流增益为 $K$。" },
              { name: "单位阶跃响应", latex: "y(t)=K(1-e^{-t/T})", note: "零初始条件。" }
            ],
            method: ["把分母常数项归一化为 1。", "读出 $K$ 与 $T$，写出极点 $-1/T$。", "根据输入类型乘以对应拉氏变换并作反变换。", "需要性能指标时使用 $t_s\\approx4T$ 或题目指定误差带。"],
            pitfalls: ["把极点数值直接当成时间常数。", "没有先归一化分母就读取 $T$。"],
            example: {
              problem: "$G(s)=4/(2s+1)$，求单位阶跃响应、时间常数和 $2\\%$ 调节时间。",
              steps: ["标准形式已给出 $K=4,T=2$。", "$y(t)=4(1-e^{-t/2})$。", "$t_s\\approx4T=8$ 秒。"],
              answer: "$y(t)=4(1-e^{-t/2})$，$T=2$ s，$t_s\\approx8$ s。"
            }
          },
          {
            id: "time-second",
            title: "典型二阶系统与动态指标",
            schools: ["828", "861"], type: "计算", tool: "second-order", query: "二阶系统 超调量 阻尼比",
            prerequisites: ["time-first"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "二阶系统是时域指标计算的核心。先将分母匹配到标准形式，再由阻尼比、自然频率和阻尼自然频率判断响应类型与指标。",
            objectives: ["由多项式读出 $\\zeta$ 和 $\\omega_n$", "计算峰值时间、超调量和调节时间", "由指标反求极点位置"],
            keyPoints: ["欠阻尼条件为 $0<\\zeta<1$，阻尼振荡频率为 $\\omega_d=\\omega_n\\sqrt{1-\\zeta^2}$。", "超调量主要由 $\\zeta$ 决定，调节时间主要由 $\\zeta\\omega_n$ 决定。", "存在闭环零点时不能机械套用标准二阶公式。"],
            formulas: [
              { name: "标准二阶", latex: "\\Phi(s)=\\frac{\\omega_n^2}{s^2+2\\zeta\\omega_ns+\\omega_n^2}", note: "无零点、单位直流增益。" },
              { name: "超调量", latex: "M_p=e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}}\\times100\\%", note: "欠阻尼单位阶跃。" },
              { name: "动态时间", latex: "t_p=\\frac{\\pi}{\\omega_d},\\qquad t_s\\approx\\frac{4}{\\zeta\\omega_n}", note: "$t_s$ 为 $2\\%$ 误差带近似。" }
            ],
            method: ["分母首项归一化并与标准二阶分母比较。", "计算 $\\omega_n$、$\\zeta$ 和 $\\omega_d$。", "确认满足欠阻尼、无附加零点等公式前提。", "代入指标公式并保留合理有效数字。"],
            pitfalls: ["把 $s$ 项系数直接当作阻尼比，漏除 $2\\omega_n$。", "把 $t_s=3/(\\zeta\\omega_n)$ 与 $4/(\\zeta\\omega_n)$ 的误差带约定混用。"],
            example: {
              problem: "闭环传递函数为 $25/(s^2+6s+25)$，求 $\\zeta$、$\\omega_n$、超调量和 $2\\%$ 调节时间。",
              steps: ["$\\omega_n=5$，$2\\zeta\\omega_n=6$，故 $\\zeta=0.6$。", "$M_p=e^{-0.6\\pi/0.8}\\times100\\%\\approx9.48\\%$。", "$t_s\\approx4/(0.6\\times5)=1.33$ s。"],
              answer: "$\\omega_n=5$ rad/s，$\\zeta=0.6$，$M_p\\approx9.48\\%$，$t_s\\approx1.33$ s。"
            }
          },
          {
            id: "time-dominant",
            title: "附加零极点、主导极点与高阶近似",
            schools: ["861"], type: "分析", tool: "second-order", query: "主导极点 高阶近似",
            prerequisites: ["time-second"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "高阶系统的响应由各极点模态及其留数共同决定。距离虚轴近、衰减慢且留数不小的极点通常占主导，可据此作低阶近似。",
            objectives: ["识别主导极点", "判断忽略远端极点的条件", "分析附加零点对超调和响应速度的影响"],
            keyPoints: ["仅看极点距离不够，还要考虑零极点抵消和留数。", "非主导极点实部绝对值通常应为主导极点的 5 倍左右。", "靠近主导极点的闭环零点会显著改变标准二阶响应。"],
            formulas: [
              { name: "模态展开", latex: "y(t)=\\sum_i R_i e^{p_it}", note: "$p_i$ 为极点，$R_i$ 为相应留数。" },
              { name: "二阶主导极点", latex: "p_{1,2}=-\\zeta\\omega_n\\pm j\\omega_n\\sqrt{1-\\zeta^2}", note: "由位置估算时域指标。" }
            ],
            method: ["求全部闭环极点与相关零点。", "比较各极点到虚轴的距离并检查留数。", "保留慢模态，合并静态增益得到低阶模型。", "用原模型与近似模型的阶跃响应或时间尺度复核。"],
            pitfalls: ["把离虚轴最近的极点无条件称为主导极点。", "近似后没有保持原系统直流增益。"],
            example: {
              problem: "系统极点为 $-1\\pm j2$ 和 $-10$，无邻近零点。能否用二阶模型近似？",
              steps: ["主导共轭极点实部绝对值为 1。", "第三极点实部绝对值为 10，是主导极点的 10 倍。", "第三模态衰减远快，且题设无邻近零点破坏近似。"],
              answer: "可以忽略 $-10$ 极点作二阶主导极点近似，但应保持原直流增益。"
            }
          }
        ]
      },
      {
        id: "steady-error",
        title: "稳态误差",
        description: "从误差传递函数、系统型别和终值定理统一处理跟踪与扰动误差。",
        nodes: [
          {
            id: "error-static",
            title: "系统型别与静态误差系数",
            schools: ["828", "861"], type: "计算", tool: "steady-error", query: "系统型别 静态误差系数",
            prerequisites: ["modeling-blocks", "time-routh"], resources: ["libretexts", "mit"],
            overview: "稳态误差必须先确认闭环稳定，再由误差传递函数使用终值定理。单位负反馈下，开环原点极点数定义系统型别。",
            objectives: ["判断系统型别", "计算 $K_p,K_v,K_a$", "求阶跃、斜坡和抛物线输入的稳态误差"],
            keyPoints: ["型别取决于开环净积分环节数，不是系统总阶数。", "终值定理要求 $sE(s)$ 的极点均在左半平面。", "非单位反馈应先推导误差传递函数，不能直接套表。"],
            formulas: [
              { name: "误差传递函数", latex: "E(s)=\\frac{R(s)}{1+G(s)H(s)}", note: "比较点误差，单位负反馈时 $H=1$。" },
              { name: "静态误差系数", latex: "K_p=\\lim_{s\\to0}L(s),\\ K_v=\\lim_{s\\to0}sL(s),\\ K_a=\\lim_{s\\to0}s^2L(s)", note: "$L=GH$。" },
              { name: "典型误差", latex: "e_{ss}^{step}=\\frac{1}{1+K_p},\\ e_{ss}^{ramp}=\\frac{1}{K_v},\\ e_{ss}^{para}=\\frac{1}{K_a}", note: "单位幅值输入。" }
            ],
            method: ["写出闭环特征方程并确认稳定。", "从开环 $L(s)$ 数原点净极点数。", "按输入阶次选择 $K_p,K_v$ 或 $K_a$。", "也可直接用 $e_{ss}=\\lim_{s\\to0}sE(s)$ 复核。"],
            pitfalls: ["闭环不稳定时仍给出有限稳态误差。", "把输入幅值遗漏；斜坡速度或抛物线加速度不是 1 时要乘相应系数。"],
            example: {
              problem: "单位负反馈开环 $G(s)=10/[s(s+2)]$，求单位斜坡稳态误差。",
              steps: ["系统含一个原点极点，为 I 型。", "$K_v=\\lim_{s\\to0}sG(s)=10/2=5$。", "$e_{ss}=1/K_v=0.2$。"],
              answer: "$e_{ss}=0.2$。"
            }
          },
          {
            id: "error-disturbance",
            title: "扰动误差与复合控制",
            schools: ["828", "861"], type: "计算", tool: "steady-error", query: "扰动 稳态误差 复合控制",
            prerequisites: ["error-static"], resources: ["libretexts", "mit"],
            overview: "扰动作用点不同，误差和输出传递函数就不同。应使用叠加原理分别令参考输入或扰动为零，不能把扰动直接当成参考输入。",
            objectives: ["推导不同扰动作用点的误差传递函数", "计算扰动稳态误差", "理解前馈补偿实现理想不变性的条件"],
            keyPoints: ["扰动进入对象前端时会受到后续对象与反馈环节共同影响。", "高低频增益对不同扰动的抑制作用不同。", "理想前馈补偿依赖模型精确和补偿器可实现。"],
            formulas: [
              { name: "对象输入端扰动输出", latex: "\\frac{Y(s)}{D(s)}=\\frac{G_2(s)}{1+G_1(s)G_2(s)H(s)}", note: "前向通道分为扰动前 $G_1$ 与扰动后 $G_2$。" },
              { name: "前馈完全补偿", latex: "G_{ff}(s)=-\\frac{G_d(s)}{G_u(s)}", note: "使扰动到输出的两条通道相消。" }
            ],
            method: ["保留扰动输入并令其他独立输入为零。", "从结构图列比较点和各中间变量方程。", "解出 $E/D$ 或 $Y/D$，再使用终值定理。", "复合控制题还要检查前馈补偿器的因果性与稳定性。"],
            pitfalls: ["不区分扰动位于控制器前、对象前或输出端。", "写出理想补偿器后不检查其是否非因果或含不稳定极点。"],
            example: {
              problem: "单位负反馈中控制器 $G_1=K$、对象 $G_2=1/(s+1)$，扰动加在对象输入端。求单位阶跃扰动引起的输出终值。",
              steps: ["$Y/D=G_2/(1+G_1G_2)=1/(s+1+K)$。", "单位阶跃 $D=1/s$。", "$y(\\infty)=\\lim_{s\\to0}s(Y/D)(1/s)=1/(1+K)$。"],
              answer: "$y(\\infty)=1/(1+K)$。"
            }
          }
        ]
      },
      {
        id: "root-locus",
        title: "根轨迹",
        description: "利用相角与幅值条件研究闭环极点随参数变化的全过程。",
        nodes: [
          {
            id: "root-rules",
            title: "根轨迹条件与绘制规则",
            schools: ["861"], type: "计算", tool: "root-locus", query: "根轨迹 绘制规则",
            prerequisites: ["time-routh", "modeling-laplace"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "负反馈特征方程写成 $1+KL(s)=0$ 后，根轨迹是 $K$ 从零到无穷时闭环极点的集合。相角条件决定点是否在轨迹上，幅值条件计算对应增益。",
            objectives: ["使用相角和幅值条件", "确定实轴段、渐近线、重心和出射角", "结合劳斯判据求虚轴交点"],
            keyPoints: ["轨迹从开环极点出发，终止于有限零点或无穷远零点。", "实轴上一点右侧的实零极点总数为奇数时属于常规负反馈根轨迹。", "复极点出射角必须计入其他所有零极点的方向角。"],
            formulas: [
              { name: "相角与幅值条件", latex: "\\angle L(s)=(2k+1)180^\\circ,\\qquad K=\\frac{1}{|L(s)|}", note: "这里把可变增益 $K$ 从 $L$ 中分离。" },
              { name: "渐近线", latex: "\\sigma_a=\\frac{\\sum p_i-\\sum z_j}{n-m},\\quad \\theta_k=\\frac{(2k+1)180^\\circ}{n-m}", note: "$k=0,1,\\ldots,n-m-1$。" }
            ],
            method: ["把特征方程整理成标准 $1+KL(s)=0$。", "标出开环零极点并确定分支数与对称性。", "依次求实轴段、渐近线、特殊点和复极点出射角。", "选取若干点用相角条件校核，再用幅值条件求 $K$。"],
            pitfalls: ["把闭环极点当成根轨迹起点。", "实轴判据中把位于考察点左侧的零极点也计入。"],
            example: {
              problem: "$L(s)=1/[s(s+2)(s+4)]$，求渐近线重心与角度。",
              steps: ["有 3 个极点、0 个零点，共 3 条渐近线。", "$\\sigma_a=(0-2-4)/3=-2$。", "角度为 $60^\\circ,180^\\circ,300^\\circ$。"],
              answer: "重心为 $-2$，渐近线角度为 $60^\\circ,180^\\circ,300^\\circ$。"
            }
          },
          {
            id: "root-breakaway",
            title: "分离点、汇合点与对应增益",
            schools: ["861"], type: "计算", tool: "root-locus", query: "根轨迹 分离点 汇合点",
            prerequisites: ["root-rules"], resources: ["libretexts", "pythonControl"],
            overview: "实轴多重闭环根对应根轨迹的分离或汇合。由 $K(s)=-D(s)/N(s)$ 对 $s$ 求导可得到候选点，但必须再检查实轴段和正增益条件。",
            objectives: ["建立增益函数 $K(s)$", "求解 $dK/ds=0$", "筛除不属于实际根轨迹的候选点"],
            keyPoints: ["导数方程的所有根只是候选点。", "候选点必须位于根轨迹实轴段并给出允许的 $K$。", "复平面重根也可由特征方程与其导数联立求得。"],
            formulas: [
              { name: "增益函数", latex: "K(s)=-\\frac{D(s)}{N(s)}", note: "特征方程为 $D(s)+KN(s)=0$。" },
              { name: "重根条件", latex: "D(s)+KN(s)=0,\\qquad D'(s)+KN'(s)=0", note: "消去 $K$ 等价于 $dK/ds=0$。" }
            ],
            method: ["从特征方程解出 $K(s)$。", "对 $K(s)$ 求导并令其为零。", "逐个代回实轴判据和相角条件。", "计算对应 $K$，保留题目规定范围内的实数增益。"],
            pitfalls: ["把导数方程全部实根直接作为分离点。", "忘记检查 $K>0$ 或题目给定的参数范围。"],
            example: {
              problem: "$L(s)=1/[s(s+4)]$，求正增益根轨迹分离点与增益。",
              steps: ["特征方程 $s(s+4)+K=0$，故 $K=-s(s+4)$。", "$dK/ds=-2s-4=0$ 得 $s=-2$。", "$K=-(-2)(2)=4>0$，且 $-2$ 位于 $(-4,0)$ 实轴段。"],
              answer: "分离点 $s=-2$，对应 $K=4$。"
            }
          },
          {
            id: "root-parameter",
            title: "参数根轨迹与性能分析",
            schools: ["861"], type: "分析", tool: "root-locus", query: "参数根轨迹",
            prerequisites: ["root-rules", "time-second"], resources: ["mit", "pythonControl"],
            overview: "当变化参数不是单纯开环增益时，把特征方程按参数整理为 $A(s)+\\lambda B(s)=0$，即可构造等效开环零极点并使用常规根轨迹规则。",
            objectives: ["把一般参数特征方程转为根轨迹形式", "确定等效零极点", "由极点轨迹分析稳定范围和动态性能"],
            keyPoints: ["等效开环零极点来自按参数分组后的 $A$ 与 $B$，不一定是原系统开环零极点。", "参数可能允许负值，此时需要零度根轨迹或变量替换。", "动态指标应由闭环主导极点位置估算。"],
            formulas: [
              { name: "参数根轨迹", latex: "A(s)+\\lambda B(s)=0\\quad\\Longrightarrow\\quad1+\\lambda\\frac{B(s)}{A(s)}=0", note: "$A$ 的根为等效极点，$B$ 的根为等效零点。" }
            ],
            method: ["写出完整闭环特征方程。", "把不含参数项组成 $A(s)$，参数系数组成 $B(s)$。", "画等效 $B/A$ 的根轨迹。", "结合虚轴交点、阻尼线和自然频率圆读出参数范围。"],
            pitfalls: ["仍使用原开环零极点绘图。", "没有确认参数的符号范围，混用常规与零度根轨迹。"],
            example: {
              problem: "特征方程为 $s^3+2s^2+(1+a)s+2=0$，写成关于 $a$ 的参数根轨迹形式。",
              steps: ["分组为 $A(s)=s^3+2s^2+s+2$，$aB(s)=as$。", "写成 $1+a\\,s/A(s)=0$。", "$A(s)=(s+2)(s^2+1)$，等效极点为 $-2,\\pm j$，等效零点为 0。"],
              answer: "$1+a\\frac{s}{(s+2)(s^2+1)}=0$。"
            }
          }
        ]
      },
      {
        id: "frequency",
        title: "频域分析",
        description: "从正弦稳态响应到 Bode、Nyquist、稳定裕度与闭环频域指标。",
        nodes: [
          {
            id: "freq-response",
            title: "频率特性与稳态正弦响应",
            schools: ["828", "861"], type: "分析", tool: "frequency", query: "频率特性 正弦响应",
            prerequisites: ["modeling-laplace", "time-routh"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "稳定线性定常系统在正弦输入下的稳态输出仍为同频正弦，幅值按 $|G(j\\omega)|$ 缩放，相位移动 $\\angle G(j\\omega)$。频率特性是传递函数在虚轴上的取值。",
            objectives: ["由 $G(j\\omega)$ 求幅频和相频特性", "写出正弦稳态输出", "理解频率响应存在的稳定性前提"],
            keyPoints: ["频率响应描述稳态部分，不包含衰减暂态。", "实系数系统满足共轭对称，只需研究 $\\omega\\ge0$。", "不稳定系统虽然可形式代入 $j\\omega$，但不能直接解释为有界稳态正弦响应。"],
            formulas: [
              { name: "正弦稳态输出", latex: "u(t)=A\\sin\\omega t\\Rightarrow y_{ss}(t)=A|G(j\\omega)|\\sin(\\omega t+\\angle G(j\\omega))", note: "系统稳定且初始暂态已衰减。" }
            ],
            method: ["把传递函数中的 $s$ 替换为 $j\\omega$。", "分离实部、虚部或按因子分别求模和相角。", "输入幅值乘以模，相位加上传递函数相角。", "统一相角象限并注明角度或弧度。"],
            pitfalls: ["把 $G(j\\omega)$ 的实部当成幅值。", "反正切计算相角时忽略象限。"],
            example: {
              problem: "$G(s)=2/(s+2)$，输入 $u=3\\sin2t$，求稳态输出。",
              steps: ["$G(j2)=2/(2+j2)$。", "$|G(j2)|=1/\\sqrt2$，相角为 $-45^\\circ$。", "输出幅值为 $3/\\sqrt2$。"],
              answer: "$y_{ss}(t)=\\frac{3}{\\sqrt2}\\sin(2t-45^\\circ)$。"
            }
          },
          {
            id: "freq-bode",
            title: "典型环节与 Bode 图",
            schools: ["828", "861"], type: "计算", tool: "frequency", query: "Bode图 转折频率",
            prerequisites: ["freq-response"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "Bode 图把乘除关系变为分贝相加与相角相加。渐近幅频图由低频增益、原点零极点和各转折频率处的斜率变化构成。",
            objectives: ["把传递函数化为 Bode 标准因子", "绘制渐近幅频与相频曲线", "计算指定频率的精确幅相"],
            keyPoints: ["一阶极点越过转折频率后增加 $-20$ dB/dec 斜率，一阶零点增加 $+20$ dB/dec。", "原点极点从最低频起就贡献斜率和 $-90^\\circ$ 相角。", "二阶环节的转折斜率为 $\\pm40$ dB/dec，阻尼影响谐振峰。"],
            formulas: [
              { name: "对数幅值", latex: "L(\\omega)=20\\log_{10}|G(j\\omega)|", note: "乘积因子对应 dB 相加。" },
              { name: "一阶极点", latex: "20\\log_{10}|1+j\\omega T|=10\\log_{10}(1+\\omega^2T^2)", note: "转折频率 $\\omega_c=1/T$。" }
            ],
            method: ["提取总增益、原点幂次和标准一/二阶因子。", "按转折频率从小到大排序。", "确定低频起点与初始斜率，再逐点修改斜率。", "相角曲线按各因子贡献相加，必要时用精确值校核。"],
            pitfalls: ["因子未标准化为 $1+sT$ 就直接读取转折频率。", "把 $20\\log$ 与 $10\\log$ 的使用对象混淆。"],
            example: {
              problem: "$G(s)=10/[s(1+0.1s)]$，给出低频斜率、转折频率和高频斜率。",
              steps: ["积分环节使初始斜率为 $-20$ dB/dec。", "一阶极点转折频率为 $1/0.1=10$ rad/s。", "越过 10 rad/s 后再减 $20$ dB/dec。"],
              answer: "低频斜率 $-20$ dB/dec，转折频率 $10$ rad/s，高频斜率 $-40$ dB/dec。"
            }
          },
          {
            id: "freq-inverse-bode",
            title: "由 Bode 图反求传递函数",
            schools: ["828", "861"], type: "分析", tool: "theory", query: "Bode图 反求传递函数",
            prerequisites: ["freq-bode"], resources: ["libretexts", "mit"],
            overview: "对最小相位系统，渐近幅频图的低频斜率、转折频率和斜率变化可以唯一确定零极点结构，再由任一幅值点求增益。",
            objectives: ["由低频斜率识别原点零极点", "由斜率变化识别有限零极点和重数", "利用幅值点确定增益并校核相频"],
            keyPoints: ["最小相位条件决定有限零极点取左半平面形式。", "斜率每变化 $20$ dB/dec 对应一个一阶零点或极点。", "非最小相位零点和纯延迟不改变幅频，却会改变相频，不能只凭幅频区分。"],
            formulas: [
              { name: "标准重构形式", latex: "G(s)=K s^q\\frac{\\prod_i(1+s/\\omega_{z_i})}{\\prod_j(1+s/\\omega_{p_j})}", note: "$q$ 由低频斜率决定。" }
            ],
            method: ["用最低频段斜率确定原点零极点净数。", "记录每个转折频率及斜率变化量。", "写出标准因子并根据最小相位条件选择符号。", "选择远离转折点的幅值读数求 $K$，最后复核全图。"],
            pitfalls: ["忽略题目是否声明最小相位。", "转折处读渐近线与实际曲线时混淆约 $3$ dB 修正。"],
            example: {
              problem: "某最小相位系统低频斜率为 $-20$ dB/dec，在 $2$ rad/s 处变为 $-40$，在 $10$ rad/s 处恢复为 $-20$，写出除增益外的结构。",
              steps: ["低频 $-20$ 表示一个原点极点。", "$2$ rad/s 处斜率减少 $20$，对应一阶极点。", "$10$ rad/s 处斜率增加 $20$，对应一阶零点。"],
              answer: "$G(s)=K\\frac{1+s/10}{s(1+s/2)}$。"
            }
          },
          {
            id: "freq-nyquist",
            title: "Nyquist 判据与稳定裕度",
            schools: ["828", "861"], type: "计算", tool: "nyquist", query: "Nyquist 相角裕度 幅值裕度",
            prerequisites: ["freq-bode", "time-routh"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "Nyquist 判据用开环频率特性对临界点 $-1+j0$ 的包围关系判断闭环右半平面极点数。稳定裕度量化系统距离临界稳定的余量。",
            objectives: ["正确确定 $P,N,Z$ 的符号约定", "处理虚轴开环极点的绕行", "计算增益交叉频率、相位交叉频率及稳定裕度"],
            keyPoints: ["必须先数开环右半平面极点 $P$。", "不同教材对顺/逆时针包围的 $N$ 符号约定不同，答题时先声明。", "相角裕度在 $|L|=1$ 处测量，幅值裕度在相角为 $-180^\\circ$ 处测量。"],
            formulas: [
              { name: "Nyquist 关系", latex: "Z=P-N", note: "采用顺时针包围 $-1$ 点为正的约定。" },
              { name: "稳定裕度", latex: "\\gamma=180^\\circ+\\angle L(j\\omega_c),\\qquad h=\\frac{1}{|L(j\\omega_g)|}", note: "$\\omega_c$ 为增益交叉频率，$\\omega_g$ 为相位交叉频率。" }
            ],
            method: ["确定开环右半平面极点数与虚轴极点。", "按完整 Nyquist 路径判断曲线对 $-1$ 点的净包围。", "由约定计算 $Z$，闭环稳定要求 $Z=0$。", "从 Bode 或频率方程求两类交叉频率与裕度。"],
            pitfalls: ["只看曲线是否穿过 $-1$，没有结合 $P$。", "把相角裕度和幅值裕度的测量频率互换。"],
            example: {
              problem: "开环无右半平面极点，Nyquist 曲线不包围 $-1$ 点。判断闭环稳定性。",
              steps: ["$P=0$。", "不包围临界点，按顺时针为正有 $N=0$。", "$Z=P-N=0$，闭环无右半平面极点。"],
              answer: "在无虚轴极点等附加问题时，闭环稳定。"
            }
          },
          {
            id: "freq-closed",
            title: "闭环频域指标与时域关系",
            schools: ["861"], type: "分析", tool: "nyquist", query: "闭环频域指标 带宽 谐振峰",
            prerequisites: ["freq-nyquist", "time-second"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "闭环谐振峰、谐振频率和带宽描述系统对不同频率信号的响应能力。对典型二阶系统，它们可与阻尼比、自然频率及时域指标建立近似关系。",
            objectives: ["计算二阶系统谐振峰和谐振频率", "理解带宽与响应速度的关系", "区分开环稳定裕度与闭环频域指标"],
            keyPoints: ["只有 $\\zeta<1/\\sqrt2$ 时典型二阶闭环频响才出现谐振峰。", "带宽增大通常意味着响应更快，但高频噪声通过能力也增强。", "裕度属于开环频率特性，$M_r,\\omega_r,\\omega_b$ 属于闭环特性。"],
            formulas: [
              { name: "二阶谐振指标", latex: "M_r=\\frac{1}{2\\zeta\\sqrt{1-\\zeta^2}},\\qquad \\omega_r=\\omega_n\\sqrt{1-2\\zeta^2}", note: "适用于 $0<\\zeta<1/\\sqrt2$。" },
              { name: "闭环带宽", latex: "|\\Phi(j\\omega_b)|=\\frac{|\\Phi(0)|}{\\sqrt2}", note: "即相对低频值下降 3 dB。" }
            ],
            method: ["确认闭环模型可近似为标准二阶。", "从分母读取 $\\zeta,\\omega_n$。", "检查是否满足谐振条件。", "用频域公式计算并与 $t_s,M_p$ 的趋势相互校核。"],
            pitfalls: ["阻尼比大于 $1/\\sqrt2$ 时仍套用谐振频率公式。", "把开环增益交叉频率直接等同于闭环带宽。"],
            example: {
              problem: "标准二阶系统 $\\zeta=0.5,\\omega_n=4$，求谐振频率和谐振峰。",
              steps: ["$0.5<1/\\sqrt2$，存在谐振。", "$\\omega_r=4\\sqrt{1-2(0.5)^2}=2\\sqrt2$。", "$M_r=1/[2(0.5)\\sqrt{1-0.25}]=2/\\sqrt3$。"],
              answer: "$\\omega_r=2\\sqrt2$ rad/s，$M_r=2/\\sqrt3\\approx1.155$。"
            }
          }
        ]
      },
      {
        id: "compensation",
        title: "系统校正",
        description: "把稳态精度、响应速度和稳定裕度转化为可实现的校正网络参数。",
        nodes: [
          {
            id: "comp-networks",
            title: "超前、滞后、滞后-超前与 PID",
            schools: ["828", "861"], type: "分析", tool: "compensation", query: "超前校正 滞后校正 PID",
            prerequisites: ["freq-bode", "error-static"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "超前校正提供正相角并提高交叉频率，滞后校正提高低频增益而尽量少动中高频，PID 则用比例、积分和微分组合调节速度、精度与阻尼。",
            objectives: ["识别各校正网络的零极点位置", "说明其对 Bode 图和时域性能的影响", "根据主要矛盾选择校正形式"],
            keyPoints: ["超前网络零点靠近原点、极点远离原点。", "滞后网络极点靠近原点、零点远离原点。", "积分改善稳态误差但降低稳定裕度；微分改善阻尼但放大高频噪声。"],
            formulas: [
              { name: "超前网络", latex: "G_c(s)=K_c\\frac{1+Ts}{1+\\alpha Ts},\\quad0<\\alpha<1", note: "最大超前相角满足 $\\sin\\phi_m=(1-\\alpha)/(1+\\alpha)$。" },
              { name: "滞后网络", latex: "G_c(s)=K_c\\frac{1+Ts}{1+\\beta Ts},\\quad\\beta>1", note: "低频增益相对高频提高约 $\\beta$ 倍。" },
              { name: "PID", latex: "G_c(s)=K_p+\\frac{K_i}{s}+K_ds", note: "实际微分通常加入高频滤波。" }
            ],
            method: ["明确未校正系统缺少的是稳态精度、相角裕度还是速度。", "若主要缺相角与速度，优先超前；若主要缺低频增益，优先滞后。", "两类指标同时严格时采用滞后-超前或 PID。", "校正后重新核算稳定裕度、带宽和稳态误差。"],
            pitfalls: ["仅根据名称判断超前/滞后，没有比较零极点位置。", "只满足一个指标，没有复核校正对其他指标的副作用。"],
            example: {
              problem: "某系统稳态误差已满足，但相角裕度过小、响应偏慢，应优先选择哪类串联校正？",
              steps: ["问题集中在相对稳定性和带宽。", "超前校正可提供正相角并提高增益交叉频率。", "滞后校正主要提高低频增益，通常会降低带宽。"],
              answer: "优先采用串联超前校正。"
            }
          },
          {
            id: "comp-frequency-design",
            title: "频率法校正设计",
            schools: ["828", "861"], type: "计算", tool: "compensation", query: "频率法 校正设计",
            prerequisites: ["comp-networks", "freq-nyquist"], resources: ["mit", "pythonControl"],
            overview: "频率法设计把稳态误差要求转成低频增益，把相角裕度与速度要求转成交叉频率附近的相角和幅值条件，再配置校正网络零极点。",
            objectives: ["由稳态指标确定开环增益", "计算所需附加相角", "配置超前或滞后网络并复核全部指标"],
            keyPoints: ["超前设计要预留 5 至 12 度相角余量，补偿新交叉频率移动。", "滞后网络的转折频率通常放在新交叉频率下方一个数量级左右。", "设计完成必须使用校正后开环重新求真实裕度。"],
            formulas: [
              { name: "超前参数", latex: "\\alpha=\\frac{1-\\sin\\phi_m}{1+\\sin\\phi_m},\\qquad \\omega_m=\\frac{1}{T\\sqrt\\alpha}", note: "$\\omega_m$ 为最大超前相角频率。" },
              { name: "最大幅值提升", latex: "20\\log_{10}|G_c(j\\omega_m)|=-10\\log_{10}\\alpha", note: "用来选取新的交叉频率。" }
            ],
            method: ["由 $K_p,K_v,K_a$ 指标先确定系统增益。", "绘制未校正 Bode 图并求当前裕度。", "选目标交叉频率，计算所需相角和网络参数。", "配置零极点后复算交叉频率、裕度、带宽与稳态误差。"],
            pitfalls: ["所需相角直接取目标裕度减当前裕度，没有留交叉频率移动余量。", "求得 $\\alpha,T$ 后未检查校正网络零极点顺序。"],
            example: {
              problem: "超前校正需要最大相角 $30^\\circ$，求 $\\alpha$。",
              steps: ["使用 $\\alpha=(1-\\sin\\phi_m)/(1+\\sin\\phi_m)$。", "$\\sin30^\\circ=0.5$。", "$\\alpha=(1-0.5)/(1+0.5)=1/3$。"],
              answer: "$\\alpha=1/3$。"
            }
          },
          {
            id: "comp-feedback-feedforward",
            title: "反馈校正与复合校正",
            schools: ["828", "861"], type: "分析", tool: "theory", query: "反馈校正 复合校正",
            prerequisites: ["comp-networks", "error-disturbance"], resources: ["libretexts", "mit"],
            overview: "局部反馈可改变被包围环节的等效动态和参数灵敏度；前馈可针对可测参考或扰动直接补偿。复合校正用前馈提高名义性能、用反馈保证鲁棒性。",
            objectives: ["推导局部反馈后的等效环节", "分析反馈对灵敏度和带宽的影响", "设计参考前馈或扰动前馈结构"],
            keyPoints: ["高环路增益可降低被包围对象的参数灵敏度。", "前馈不依据输出误差，无法单独修正未知模型误差。", "两自由度控制可分别整形跟踪和抗扰性能。"],
            formulas: [
              { name: "局部反馈等效", latex: "G_{eq}(s)=\\frac{G(s)}{1+G(s)H_f(s)}", note: "局部负反馈。" },
              { name: "参数灵敏度", latex: "S_T^G=\\frac{\\partial T/T}{\\partial G/G}=\\frac{1}{1+GH}", note: "单位负反馈简单情形。" }
            ],
            method: ["先画清主反馈、局部反馈和前馈通道。", "分别推导参考到输出、扰动到输出的传递函数。", "用前馈满足名义跟踪或扰动抵消。", "用反馈检查稳定性、鲁棒性与剩余误差。"],
            pitfalls: ["把前馈误称为闭环控制。", "假设模型完全准确而没有说明前馈补偿的鲁棒性限制。"],
            example: {
              problem: "对象为 $G_p(s)$，希望名义参考到输出为 1，采用前馈 $G_{ff}$ 且暂不考虑反馈，理想前馈为何？",
              steps: ["名义输出 $Y=G_pG_{ff}R$。", "要求 $Y/R=1$。", "因此 $G_pG_{ff}=1$。"],
              answer: "$G_{ff}(s)=G_p^{-1}(s)$，但还必须检查逆系统是否因果、稳定和可实现。"
            }
          }
        ]
      },
      {
        id: "discrete",
        title: "离散系统",
        description: "覆盖采样保持、Z 变换、脉冲传递函数、稳定判据与离散性能。",
        nodes: [
          {
            id: "discrete-sampling",
            title: "采样、保持、恢复与差分方程",
            schools: ["828", "861"], type: "分析", tool: "discrete", query: "采样 零阶保持 差分方程",
            prerequisites: ["modeling-differential", "freq-response"], resources: ["libretexts", "scipySignal"],
            overview: "采样把连续信号转换为序列，保持器在样点间生成连续控制信号。采样频率、混叠和零阶保持附加相位滞后是离散控制的基础。",
            objectives: ["说明理想采样与零阶保持过程", "使用采样定理判断混叠", "由连续模型建立差分方程"],
            keyPoints: ["带限信号无失真恢复要求 $\\omega_s>2\\omega_{max}$。", "零阶保持输出为分段常值，并引入幅值衰减和相位滞后。", "连续稳定域经 $z=e^{sT}$ 映射到单位圆内。"],
            formulas: [
              { name: "采样映射", latex: "z=e^{sT}", note: "$s$ 左半平面映射到 $|z|<1$。" },
              { name: "零阶保持器", latex: "G_h(s)=\\frac{1-e^{-sT}}{s}", note: "保持一个采样周期。" },
              { name: "采样定理", latex: "\\omega_s>2\\omega_{max}", note: "理想带限信号的严格条件。" }
            ],
            method: ["明确采样周期 $T$ 与采样角频率 $2\\pi/T$。", "比较信号最高频率与 Nyquist 频率。", "选择前向差分、后向差分、双线性变换或精确 ZOH 离散化。", "检查离散模型的单位圆稳定性。"],
            pitfalls: ["把 Hz 与 rad/s 直接比较。", "忽略零阶保持器导致的附加相位滞后。"],
            example: {
              problem: "连续信号最高频率为 20 Hz，采样频率为 30 Hz，是否满足无混叠采样条件？",
              steps: ["Nyquist 最低采样频率为 $2\\times20=40$ Hz。", "实际采样频率 30 Hz 小于 40 Hz。", "频谱会发生混叠。"],
              answer: "不满足，应取大于 40 Hz 的采样频率并留实际滤波余量。"
            }
          },
          {
            id: "discrete-z",
            title: "Z 变换与 Z 反变换",
            schools: ["828", "861"], type: "计算", tool: "discrete", query: "Z变换 Z反变换 部分分式",
            prerequisites: ["discrete-sampling", "modeling-laplace"], resources: ["libretexts", "scipySignal"],
            overview: "Z 变换把差分方程转为代数方程。考研常用定义法、基本变换对、移位性质和部分分式法，同时要结合收敛域判断序列方向。",
            objectives: ["计算常见序列的 Z 变换", "使用移位和终值性质", "用部分分式求 Z 反变换"],
            keyPoints: ["同一代数表达式配合不同收敛域可对应不同序列。", "单边 Z 变换适合含初始条件的因果差分方程。", "部分分式时常先展开 $X(z)/z$，以匹配 $z/(z-a)$ 变换对。"],
            formulas: [
              { name: "Z 变换", latex: "X(z)=\\sum_{k=-\\infty}^{\\infty}x[k]z^{-k}", note: "还需给出收敛域。" },
              { name: "右边指数序列", latex: "a^ku[k]\\longleftrightarrow\\frac{z}{z-a},\\quad|z|>|a|", note: "因果序列。" }
            ],
            method: ["判断采用双边还是单边 Z 变换。", "使用基本变换对和移位性质得到 $X(z)$。", "反变换时因式分解并明确收敛域。", "展开 $X(z)/z$ 或使用留数法，再匹配序列。"],
            pitfalls: ["只写有理式而不写收敛域。", "延迟性质中的指数正负号写反。"],
            example: {
              problem: "求 $x[k]=(1/2)^ku[k]$ 的 Z 变换与收敛域。",
              steps: ["代入定义得到几何级数 $\\sum_{k=0}^\\infty(0.5z^{-1})^k$。", "和为 $1/(1-0.5z^{-1})$。", "收敛条件 $|0.5z^{-1}|<1$。"],
              answer: "$X(z)=z/(z-0.5)$，ROC 为 $|z|>0.5$。"
            }
          },
          {
            id: "discrete-pulse",
            title: "脉冲传递函数与开环模型",
            schools: ["828", "861"], type: "计算", tool: "discrete", query: "脉冲传递函数",
            prerequisites: ["discrete-z", "modeling-blocks"], resources: ["libretexts", "scipySignal", "pythonControl"],
            overview: "脉冲传递函数描述零初始条件下采样输出 Z 变换与采样输入 Z 变换之比。含零阶保持器时应先把保持器与连续对象组合后再采样。",
            objectives: ["由连续对象求 ZOH 脉冲传递函数", "建立离散闭环模型", "区分采样器相对位置对等效模型的影响"],
            keyPoints: ["一般不能把两个连续环节分别星号变换后再相乘。", "ZOH 等效常用 $(1-z^{-1})\\mathcal Z\\{G(s)/s\\}$。", "脉冲传递函数的极点决定零输入离散动态。"],
            formulas: [
              { name: "ZOH 等效", latex: "G(z)=(1-z^{-1})\\mathcal Z\\left\\{\\frac{G(s)}{s}\\right\\}", note: "连续对象输入端有零阶保持器。" },
              { name: "离散闭环", latex: "\\Phi(z)=\\frac{G(z)}{1+G(z)H(z)}", note: "结构满足离散代数关系时。" }
            ],
            method: ["标明采样器、保持器与连续环节位置。", "将 ZOH 与其后的连续对象作为整体。", "求对象阶跃响应在 $kT$ 的样值并作 Z 变换。", "构造开环和闭环脉冲传递函数，检查因果性。"],
            pitfalls: ["把 $G(s)$ 中的 $s$ 直接替换成 $z$。", "忽略串联连续环节之间没有采样器，错误地分别离散后相乘。"],
            example: {
              problem: "单位 ZOH 后接 $G(s)=1/(s+1)$，采样周期 $T$，求脉冲传递函数。",
              steps: ["对象单位阶跃响应为 $1-e^{-t}$。", "采样序列为 $1-e^{-kT}$。", "乘以 $(1-z^{-1})$ 后化简。"],
              answer: "$G(z)=\\frac{1-e^{-T}}{z-e^{-T}}$。"
            }
          },
          {
            id: "discrete-jury",
            title: "Jury 判据与离散稳定性",
            schools: ["828", "861"], type: "计算", tool: "discrete", query: "Jury判据 单位圆稳定",
            prerequisites: ["discrete-pulse", "time-routh"], resources: ["libretexts", "scipySignal"],
            overview: "离散线性定常系统渐近稳定当且仅当全部闭环极点严格位于单位圆内。Jury 判据可直接由特征多项式系数判断单位圆稳定性。",
            objectives: ["由极点模判断稳定性", "使用低阶 Jury 条件", "通过双线性变换转用劳斯判据"],
            keyPoints: ["单位圆上的单根对应临界稳定，不属于渐近稳定。", "二阶多项式可用 $D(1)>0,D(-1)>0,|a_0|<a_n$。", "双线性变换必须保持稳定域映射方向。"],
            formulas: [
              { name: "二阶 Jury 条件", latex: "D(z)=a_2z^2+a_1z+a_0:\quad D(1)>0,\\ D(-1)>0,\\ |a_0|<a_2", note: "先令最高次系数 $a_2>0$。" },
              { name: "双线性映射", latex: "z=\\frac{1+w}{1-w}", note: "$|z|<1$ 映射到 $\\operatorname{Re}w<0$。" }
            ],
            method: ["写出闭环特征多项式并补齐缺项。", "低阶时直接使用 Jury 必要充分条件。", "高阶时构造 Jury 表或作双线性变换。", "含参数时联立全部严格不等式并检查边界根。"],
            pitfalls: ["使用连续系统左半平面判据判断 z 平面极点。", "将 $|a_0|<a_n$ 写成不带绝对值的不等式。"],
            example: {
              problem: "判断 $D(z)=z^2-0.5z+0.2$ 是否稳定。",
              steps: ["$D(1)=0.7>0$。", "$D(-1)=1.7>0$。", "$|0.2|<1$，三条二阶 Jury 条件均满足。"],
              answer: "全部根位于单位圆内，系统渐近稳定。"
            }
          },
          {
            id: "discrete-performance",
            title: "离散动态响应与稳态误差",
            schools: ["828", "861"], type: "计算", tool: "discrete", query: "离散系统 稳态误差 动态响应",
            prerequisites: ["discrete-jury", "error-static"], resources: ["libretexts", "scipySignal", "pythonControl"],
            overview: "离散响应由 z 平面极点模和辐角决定。稳态误差仍可通过离散终值定理计算，但必须保证相关极点位于单位圆内。",
            objectives: ["由离散极点估算衰减与振荡", "使用离散终值定理", "计算离散系统型别与典型输入误差"],
            keyPoints: ["极点模决定每个采样步的衰减，辐角决定离散振荡频率。", "$z=1$ 附近的极点对应积分作用。", "终值定理要求 $(z-1)X(z)$ 除允许的 $z=1$ 外其余极点均在单位圆内。"],
            formulas: [
              { name: "离散终值定理", latex: "\\lim_{k\\to\\infty}x[k]=\\lim_{z\\to1}(z-1)X(z)", note: "满足稳定性条件时。" },
              { name: "极点映射", latex: "z=re^{j\\theta}\\Rightarrow x[k]\\sim r^k\\cos(k\\theta+\\phi)", note: "$r<1$ 时衰减。" }
            ],
            method: ["先用 Jury 或求根确认闭环稳定。", "写出 $E(z)$ 或 $Y(z)$。", "使用离散终值定理计算稳态值。", "由主导极点模与角度解释响应速度和振荡。"],
            pitfalls: ["不检查单位圆稳定性就使用终值定理。", "把连续斜坡 $t$ 与离散斜坡 $kT$ 的幅值尺度混淆。"],
            example: {
              problem: "$X(z)=z/[z-0.8]$，求序列终值。",
              steps: ["极点 $0.8$ 在单位圆内。", "应用终值定理 $\\lim_{z\\to1}(z-1)z/(z-0.8)$。", "分子在 $z=1$ 为零。"],
              answer: "终值为 0；对应序列为 $0.8^ku[k]$。"
            }
          }
        ]
      },
      {
        id: "nonlinear",
        title: "非线性系统",
        description: "用描述函数近似非线性环节的基波效应，并预测自激振荡。",
        nodes: [
          {
            id: "nonlinear-describing",
            title: "典型非线性描述函数推导",
            schools: ["828", "861"], type: "证明", tool: "nonlinear", query: "描述函数 推导",
            prerequisites: ["freq-response", "fundamentals-feedback"], resources: ["libretexts", "mit"],
            overview: "描述函数用非线性输出的基波分量近似整个非线性环节，是幅值相关的等效频率响应。推导从正弦输入和傅里叶系数开始。",
            objectives: ["写出描述函数的一般定义", "推导继电、死区、饱和与滞环描述函数", "判断描述函数是实数还是复数"],
            keyPoints: ["输入假设为单一正弦，只保留输出基波。", "奇对称、单值、无记忆非线性通常给出实描述函数。", "滞环产生与输入正交的基波分量，因此描述函数含虚部。"],
            formulas: [
              { name: "基波系数", latex: "a_1=\\frac{1}{\\pi}\\int_{-\\pi}^{\\pi}y(\\theta)\\cos\\theta\\,d\\theta,\\quad b_1=\\frac{1}{\\pi}\\int_{-\\pi}^{\\pi}y(\\theta)\\sin\\theta\\,d\\theta", note: "输入为 $A\\sin\\theta$。" },
              { name: "理想继电", latex: "N(A)=\\frac{4M}{\\pi A}", note: "输出幅值为 $\\pm M$。" }
            ],
            method: ["令输入 $x=A\\sin\\theta$，确定非线性输出分段表达式。", "利用对称性缩短积分区间。", "计算输出基波正弦、余弦系数。", "用基波复幅值除以输入幅值得到 $N(A)$。"],
            pitfalls: ["把非线性的静态斜率直接当成描述函数。", "忽略描述函数依赖输入幅值和适用的幅值区间。"],
            example: {
              problem: "理想继电输出为 $y=M\\operatorname{sgn}(x)$，输入 $x=A\\sin\\theta$，写出描述函数。",
              steps: ["输出为与正弦同相的方波，奇对称且无余弦基波。", "方波基波幅值为 $4M/\\pi$。", "除以输入幅值 $A$。"],
              answer: "$N(A)=4M/(\\pi A)$。"
            }
          },
          {
            id: "nonlinear-limit-cycle",
            title: "描述函数稳定性与自激振荡",
            schools: ["828", "861"], type: "计算", tool: "nonlinear", query: "描述函数 自激振荡",
            prerequisites: ["nonlinear-describing", "freq-nyquist"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "非线性环节 $N(A)$ 与线性部分 $G(j\\omega)$ 构成的闭环若满足谐波平衡条件，可能出现幅值为 $A$、频率为 $\\omega$ 的极限环。",
            objectives: ["使用 $G(j\\omega)N(A)=-1$", "用复平面交点求振幅和频率", "判断预测极限环的局部稳定性"],
            keyPoints: ["描述函数法给出近似预测，不是严格稳定性证明。", "线性部分应具有较强低通特性以衰减高次谐波。", "交点是否稳定需观察幅值扰动后轨迹相对 $-1/N(A)$ 曲线的方向。"],
            formulas: [
              { name: "谐波平衡", latex: "1+G(j\\omega)N(A)=0\\quad\\Longleftrightarrow\\quad G(j\\omega)=-\\frac{1}{N(A)}", note: "联立幅值与相角条件求 $A,\\omega$。" }
            ],
            method: ["求非线性描述函数及有效幅值范围。", "画或解析表示 $-1/N(A)$ 轨迹。", "求它与线性部分 Nyquist 曲线的交点。", "由交点分别读出 $A$ 与 $\\omega$，再讨论稳定性和近似前提。"],
            pitfalls: ["有交点就断言整个非线性系统全局稳定或不稳定。", "求出的振幅不在描述函数适用区间内却未剔除。"],
            example: {
              problem: "理想继电 $N(A)=4/(\\pi A)$，若线性部分在 $\\omega=2$ 时 $G(j2)=-0.5$，预测极限环幅值。",
              steps: ["谐波平衡要求 $G=-1/N$。", "$-0.5=-\\pi A/4$。", "解得 $A=2/\\pi$。"],
              answer: "预测振幅 $A=2/\\pi$，频率 $\\omega=2$ rad/s；还需检查局部稳定性与低通假设。"
            }
          }
        ]
      },
      {
        id: "state-space",
        title: "状态空间",
        description: "从状态建模、矩阵指数到能控能观、Lyapunov、反馈和观测器。",
        nodes: [
          {
            id: "state-model",
            title: "状态空间建模与状态方程求解",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "状态空间 建模",
            prerequisites: ["modeling-differential"], resources: ["libretexts", "scipySignal", "pythonControl"],
            overview: "状态变量是与未来输入共同决定系统未来运动的最小变量集合。状态空间模型能处理非零初值、多输入多输出和内部变量。",
            objectives: ["选择状态变量并写出 $A,B,C,D$", "区分状态、输入和输出方程", "写出连续线性系统的完整解"],
            keyPoints: ["状态变量选取不唯一，但最小实现的状态维数等于系统阶数。", "状态必须在给定输入下唯一决定未来，不要求能够直接测量。", "直接传递矩阵 $D$ 表示输入对输出的瞬时作用。"],
            formulas: [
              { name: "状态模型", latex: "\\dot x=Ax+Bu,\\qquad y=Cx+Du", note: "连续线性定常系统。" },
              { name: "状态解", latex: "x(t)=e^{At}x(0)+\\int_0^t e^{A(t-\\tau)}Bu(\\tau)\\,d\\tau", note: "第一项为零输入响应。" }
            ],
            method: ["从储能元件变量或高阶微分方程选取独立状态。", "逐个写一阶状态导数。", "按 $x,u$ 系数排列得到 $A,B$。", "由输出定义得到 $C,D$，检查维数。"],
            pitfalls: ["选择彼此线性相关的变量作为状态。", "输出方程中漏掉直接通道 $D u$。"],
            example: {
              problem: "$\\ddot y+3\\dot y+2y=u$，取 $x_1=y,x_2=\\dot y$，写状态模型。",
              steps: ["$\\dot x_1=x_2$。", "$\\dot x_2=-2x_1-3x_2+u$。", "$y=x_1$。"],
              answer: "$A=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix},B=\\begin{bmatrix}0\\\\1\\end{bmatrix},C=\\begin{bmatrix}1&0\\end{bmatrix},D=0$。"
            }
          },
          {
            id: "state-conversion",
            title: "传递函数、状态模型与等价变换",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "传递函数 状态空间 转换",
            prerequisites: ["state-model", "modeling-laplace"], resources: ["libretexts", "scipySignal", "pythonControl"],
            overview: "状态模型到传递矩阵由消去状态得到；传递函数到状态模型可选能控标准型、能观标准型或对角型。非奇异状态变换不改变输入输出行为。",
            objectives: ["计算 $G(s)=C(sI-A)^{-1}B+D$", "构造常见标准型实现", "完成非奇异状态变换"],
            keyPoints: ["传递函数只保留能控且能观部分，可能隐藏内部模态。", "不同状态变量对应相似矩阵 $A$。", "状态变换 $x=Tz$ 后 $B,C$ 也必须同步变换。"],
            formulas: [
              { name: "传递矩阵", latex: "G(s)=C(sI-A)^{-1}B+D", note: "零初始条件。" },
              { name: "状态变换", latex: "\\bar A=T^{-1}AT,\\quad\\bar B=T^{-1}B,\\quad\\bar C=CT", note: "$x=T\\bar x$。" }
            ],
            method: ["状态到传函：构造 $sI-A$ 并求逆或伴随矩阵。", "传函到状态：先使分母首一并处理真分式与直通项。", "按标准型填入 $A,B,C,D$。", "变换后用传递函数或特征值复核等价性。"],
            pitfalls: ["只变换 $A$，没有变换 $B,C$。", "非严格真传递函数实现时漏掉 $D$。"],
            example: {
              problem: "$A=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix},B=[0,1]^T,C=[1,0],D=0$，求传递函数。",
              steps: ["$sI-A=\\begin{bmatrix}s&-1\\\\2&s+3\\end{bmatrix}$。", "行列式为 $s^2+3s+2$。", "$C(sI-A)^{-1}B=1/(s^2+3s+2)$。"],
              answer: "$G(s)=1/(s^2+3s+2)$。"
            }
          },
          {
            id: "state-transition",
            title: "状态转移矩阵",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "状态转移矩阵 矩阵指数",
            prerequisites: ["state-model"], resources: ["libretexts", "scipySignal", "pythonControl"],
            overview: "状态转移矩阵 $\\Phi(t)=e^{At}$ 描述零输入状态从一个时刻到另一时刻的传播。可通过拉氏反变换、凯莱-哈密顿、多项式插值或对角化计算。",
            objectives: ["掌握状态转移矩阵的性质", "使用多种方法计算 $e^{At}$", "利用 $\\Phi$ 求状态响应"],
            keyPoints: ["$\\Phi(0)=I$，$\\Phi(t_1+t_2)=\\Phi(t_1)\\Phi(t_2)$。", "$A$ 与 $e^{At}$ 可交换。", "矩阵不可对角化时要用 Jordan 形式或凯莱-哈密顿法。"],
            formulas: [
              { name: "矩阵指数", latex: "e^{At}=I+At+\\frac{A^2t^2}{2!}+\\cdots", note: "对任意方阵收敛。" },
              { name: "拉氏法", latex: "\\Phi(t)=\\mathcal L^{-1}\\{(sI-A)^{-1}\\}", note: "适合低阶符号计算。" }
            ],
            method: ["先求特征值并判断能否方便对角化。", "对角化时用 $A=T\\Lambda T^{-1}$ 得 $e^{At}=Te^{\\Lambda t}T^{-1}$。", "低阶也可求 $(sI-A)^{-1}$ 后逐项反变换。", "用 $\\Phi(0)=I$ 和 $\\dot\\Phi=A\\Phi$ 校核。"],
            pitfalls: ["把 $e^{At}$ 按元素分别取指数。", "重复特征值时默认一定可对角化。"],
            example: {
              problem: "$A=\\operatorname{diag}(-1,-2)$，求状态转移矩阵。",
              steps: ["$A$ 已为对角阵。", "对角阵矩阵指数等于各对角元素指数。", "非对角元素保持为零。"],
              answer: "$e^{At}=\\begin{bmatrix}e^{-t}&0\\\\0&e^{-2t}\\end{bmatrix}$。"
            }
          },
          {
            id: "state-controllability",
            title: "能控性、能观性与系统实现",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "能控性 能观性",
            prerequisites: ["state-model", "state-conversion"], resources: ["libretexts", "pythonControl"],
            overview: "能控性判断输入能否驱动全部状态，能观性判断输出能否反推出全部状态。二者是状态反馈和观测器设计的前提，并在非奇异状态变换下不变。",
            objectives: ["使用 Kalman 秩判据", "使用 PBH 判据处理参数和特征值问题", "判断实现是否最小"],
            keyPoints: ["单输入 n 阶系统能控矩阵为 $[B,AB,\\ldots,A^{n-1}B]$。", "能观性与能控性互为对偶。", "能控且能观的实现才是给定传递函数的最小实现。"],
            formulas: [
              { name: "Kalman 判据", latex: "\\mathcal C=[B,AB,\\ldots,A^{n-1}B],\\quad\\mathcal O=\\begin{bmatrix}C\\\\CA\\\\\\vdots\\\\CA^{n-1}\\end{bmatrix}", note: "满秩 $n$ 分别表示完全能控、完全能观。" },
              { name: "PBH 判据", latex: "\\operatorname{rank}[\\lambda I-A, B]=n,\\quad\\operatorname{rank}\\begin{bmatrix}\\lambda I-A\\\\C\\end{bmatrix}=n", note: "对 $A$ 的每个特征值检查。" }
            ],
            method: ["确认状态维数 $n$。", "构造能控矩阵或能观矩阵并求秩。", "含参数时可用行列式或 PBH 判据找降秩条件。", "把结论与不可控/不可观特征值联系起来。"],
            pitfalls: ["矩阵不是方阵时仍直接求行列式判断秩。", "只看 $B$ 或 $C$ 是否含零元素判断能控能观。"],
            example: {
              problem: "$A=\\operatorname{diag}(-1,-2),B=[1,0]^T$，判断能控性。",
              steps: ["$AB=[-1,0]^T$。", "$\\mathcal C=[B,AB]=\\begin{bmatrix}1&-1\\\\0&0\\end{bmatrix}$。", "秩为 1，小于状态维数 2。"],
              answer: "系统不完全能控，特征值 $-2$ 对应模态不可控。"
            }
          },
          {
            id: "state-decomposition",
            title: "结构分解与标准型",
            schools: ["861"], type: "计算", tool: "state-space", query: "结构分解 能控标准型",
            prerequisites: ["state-controllability"], resources: ["libretexts", "pythonControl"],
            overview: "Kalman 结构分解把状态空间划分为能控能观、能控不能观、不能控能观、不能控不能观四部分。输入输出传递函数只保留能控且能观模态。",
            objectives: ["构造能控/能观子空间基", "完成 Kalman 分解", "理解标准型与最小实现的关系"],
            keyPoints: ["变换矩阵的列应由相关子空间基补成全空间基。", "不可控模态不受输入影响，不可观模态不出现在输出中。", "极零抵消常对应非最小实现中隐藏的不可控或不可观模态。"],
            formulas: [
              { name: "能控分解结构", latex: "\\bar A=\\begin{bmatrix}A_c&A_{12}\\\\0&A_{uc}\\end{bmatrix},\\qquad\\bar B=\\begin{bmatrix}B_c\\\\0\\end{bmatrix}", note: "变换后能控子空间在前。" }
            ],
            method: ["求 $\\mathcal C$ 的列空间作为能控子空间。", "选取线性无关列并补基得到变换矩阵。", "计算变换后的 $A,B,C$ 并识别各子块。", "能观分解可对偶处理；最小实现保留能控能观部分。"],
            pitfalls: ["变换矩阵列向量顺序与分块解释不一致。", "删去不可控状态后没有同步检查输出和耦合项。"],
            example: {
              problem: "$A=\\operatorname{diag}(-1,-2),B=[1,0]^T,C=[1,1]$，指出最小实现保留的模态。",
              steps: ["$-1$ 模态能被输入激励且出现在输出中。", "$-2$ 模态不能被输入激励，虽可观但不可控。", "输入输出传递函数只包含 $-1$ 模态。"],
              answer: "最小实现仅保留特征值 $-1$ 的一阶能控能观部分。"
            }
          },
          {
            id: "state-lyapunov",
            title: "Lyapunov 稳定性与方程",
            schools: ["828", "861"], type: "证明", tool: "state-space", query: "Lyapunov 稳定性 方程",
            prerequisites: ["state-model", "time-routh"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "Lyapunov 第二法不显式求解轨迹，而是寻找沿轨迹单调下降的正定能量函数。对连续线性系统，Hurwitz 稳定与 Lyapunov 方程正定解等价。",
            objectives: ["区分稳定、渐近稳定与指数稳定", "判断二次型正定性", "求解连续 Lyapunov 方程并作稳定性证明"],
            keyPoints: ["$V>0,\\dot V<0$ 给出渐近稳定；$\\dot V\\le0$ 通常只能直接得到稳定，还需 LaSalle 等进一步分析。", "线性系统 $A$ Hurwitz 时，对任意 $Q>0$ 都存在唯一 $P>0$。", "Sylvester 判据可用顺序主子式判断对称矩阵正定。"],
            formulas: [
              { name: "Lyapunov 方程", latex: "A^TP+PA=-Q,\\qquad Q=Q^T>0", note: "$A$ Hurwitz 当且仅当解 $P=P^T>0$。" },
              { name: "二次型导数", latex: "V=x^TPx\\Rightarrow\\dot V=x^T(A^TP+PA)x", note: "零输入线性系统。" }
            ],
            method: ["选择 $Q>0$，常取单位阵。", "令 $P$ 为未知对称矩阵并代入方程。", "解线性方程组得到 $P$。", "检查 $P$ 的顺序主子式为正，再由 $\\dot V=-x^TQx<0$ 下结论。"],
            pitfalls: ["求得 $P$ 后不验证对称正定。", "由半负定导数直接断言全局渐近稳定。"],
            example: {
              problem: "标量系统 $\\dot x=-2x$，取 $Q=1$，求 Lyapunov 方程的 $P$。",
              steps: ["标量 $A=-2$。", "$A^TP+PA=-4P=-1$。", "$P=1/4>0$，且 $\\dot V=-x^2<0$。"],
              answer: "$P=1/4$，原点全局渐近稳定。"
            }
          },
          {
            id: "state-feedback",
            title: "状态/输出反馈与极点配置",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "状态反馈 极点配置",
            prerequisites: ["state-controllability", "state-conversion"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "完全能控系统可用状态反馈 $u=-Kx+vr$ 任意配置闭环极点。反馈增益通过比较特征多项式或 Ackermann 公式计算，前置增益用于恢复参考跟踪。",
            objectives: ["判断能控后配置闭环极点", "计算单输入反馈增益", "区分状态反馈与静态输出反馈能力"],
            keyPoints: ["闭环矩阵为 $A-BK$，符号取决于反馈定义。", "极点配置不能改变系统能控性。", "静态输出反馈 $u=-Fy$ 一般不能任意配置全部极点。"],
            formulas: [
              { name: "闭环系统", latex: "u=-Kx+vr\\Rightarrow\\dot x=(A-BK)x+Bvr", note: "极点为 $A-BK$ 的特征值。" },
              { name: "Ackermann 公式", latex: "K=e_n^T\\mathcal C^{-1}\\phi_d(A)", note: "单输入完全能控系统。" }
            ],
            method: ["先构造能控矩阵并确认满秩。", "写期望特征多项式。", "令 $K$ 为未知，展开 $|sI-(A-BK)|$ 并比较系数，或用 Ackermann 公式。", "计算闭环特征值并根据跟踪需求求前置增益。"],
            pitfalls: ["系统不可控仍强行配置所有极点。", "反馈写成 $u=Kx$ 却仍使用 $A-BK$。"],
            example: {
              problem: "$A=\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix},B=[0,1]^T$，取 $u=-[k_1,k_2]x$，希望极点为 $-2,-3$。求 $K$。",
              steps: ["闭环特征多项式为 $s^2+k_2s+k_1$。", "期望多项式 $(s+2)(s+3)=s^2+5s+6$。", "比较系数得 $k_2=5,k_1=6$。"],
              answer: "$K=[6,5]$。"
            }
          },
          {
            id: "state-observer",
            title: "状态观测器与分离原理",
            schools: ["828", "861"], type: "计算", tool: "state-space", query: "状态观测器 分离原理",
            prerequisites: ["state-controllability", "state-feedback"], resources: ["libretexts", "mit", "pythonControl"],
            overview: "状态不能全部测量时，用模型、输入和输出构造观测器估计状态。能观系统可配置观测误差极点；分离原理允许反馈增益和观测器增益分别设计。",
            objectives: ["构造全维状态观测器", "配置观测器误差极点", "说明带观测器反馈闭环极点组成"],
            keyPoints: ["估计误差满足 $\\dot e=(A-LC)e$。", "观测器设计与对偶系统 $(A^T,C^T)$ 的状态反馈设计等价。", "观测器极点通常比控制器极点快，但过快会放大测量噪声。"],
            formulas: [
              { name: "全维观测器", latex: "\\dot{\\hat x}=A\\hat x+Bu+L(y-C\\hat x)", note: "误差 $e=x-\\hat x$。" },
              { name: "误差动态", latex: "\\dot e=(A-LC)e", note: "完全能观时可任意配置其极点。" },
              { name: "分离原理", latex: "\\sigma_{closed}=\\sigma(A-BK)\\cup\\sigma(A-LC)", note: "带全维观测器的状态反馈。" }
            ],
            method: ["用能观矩阵确认系统完全能观。", "选择比控制闭环适当更快的观测器极点。", "对偶使用极点配置法求 $L$。", "验证 $A-LC$ 特征值，并与反馈闭环极点合并检查。"],
            pitfalls: ["把观测器闭环矩阵写成 $A-CL$，维数也可能不匹配。", "无限加快观测器极点而不考虑噪声和模型误差。"],
            example: {
              problem: "$A=\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix},C=[1,0]$，求使观测器极点为 $-4,-5$ 的 $L=[l_1,l_2]^T$。",
              steps: ["$A-LC=\\begin{bmatrix}-l_1&1\\\\-l_2&0\\end{bmatrix}$。", "特征多项式为 $s^2+l_1s+l_2$。", "期望多项式 $(s+4)(s+5)=s^2+9s+20$。"],
              answer: "$L=[9,20]^T$。"
            }
          }
        ]
      }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
