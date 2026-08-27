const SOURCE_PAGE_URL =
  "https://americanenglish.state.gov/resources/everyday-conversations-learning-american-english";
const SOURCE_TITLE = "Everyday Conversations: Learning American English";
const AUDIO_SOURCE_ROOT = "https://americanenglish.state.gov/files/ae/resource_files";
const AUDIO_OBJECT_PREFIX = "english-listening/everyday-conversations";

function audioMetadata(fileName, audioByteLength) {
  return {
    audioFileName: fileName,
    audioByteLength,
    audioObjectKey: `${AUDIO_OBJECT_PREFIX}/${fileName}`,
    audioSourceUrl: `${AUDIO_SOURCE_ROOT}/${fileName}`,
  };
}

function line(speaker, text, translation, note) {
  return { speaker, text, translation, note };
}

function question(id, prompt, choices, correctOptionId, explanation) {
  return {
    id,
    prompt,
    options: choices.map(([optionId, content], index) => ({
      id: optionId,
      label: String.fromCharCode(65 + index),
      content,
    })),
    correctOptionId,
    explanation,
  };
}

export const englishListeningScenes = [
  {
    id: "ordering-a-meal",
    number: "01",
    englishTitle: "ORDERING A MEAL",
    chineseTitle: "餐厅点餐",
    context: "听清饮品、主菜、配菜和牛肉熟度。",
    level: "日常",
    duration: "144 秒",
    tone: "yellow",
    ...audioMetadata("dialogue_2-01_ordering_a_meal.mp3", 4612726),
    transcript: [
      line("WAITER", "Hello, I’ll be your waiter today. Can I start you off with something to drink?", "你好，今天由我为你们服务。先来点喝的吗？", "start you off with 常用于先询问饮品或开胃菜。"),
      line("RALPH", "Yes. I’ll have iced tea, please.", "好的，我要冰茶。", "I’ll have… 是自然、直接的点餐表达。"),
      line("ANNA", "And I’ll have lemonade.", "我要柠檬水。", "留意 iced tea 与 lemonade 两种不同饮品。"),
      line("WAITER", "OK. Are you ready to order, or do you need a few minutes?", "好的。你们准备好点餐了吗，还是还需要几分钟？", "ready to order 表示准备好点餐。"),
      line("RALPH", "I think we’re ready. I’ll have the tomato soup to start, and the roast beef with mashed potatoes and peas.", "我想我们准备好了。我先要番茄汤，再要烤牛肉配土豆泥和豌豆。", "to start 后是前菜；with 后是配菜。"),
      line("WAITER", "How do you want the beef — rare, medium, or well done?", "牛肉要几分熟——偏生、中等还是全熟？", "rare、medium、well done 是常见熟度表达。"),
      line("RALPH", "Well done, please.", "全熟，谢谢。", "重点捕捉 well done。"),
      line("ANNA", "And I’ll just have the fish, with potatoes and a salad.", "我只要鱼，配土豆和沙拉。", "just have 表示只点这些，不再加前菜。"),
    ],
    questions: [
      question("meal-ralph-drink", "Ralph 点了什么饮品？", [["tea", "冰茶"], ["lemonade", "柠檬水"], ["coffee", "咖啡"]], "tea", "Ralph 说 I’ll have iced tea, please。"),
      question("meal-beef", "Ralph 的牛肉要什么熟度？", [["rare", "偏生"], ["medium", "中等"], ["well", "全熟"]], "well", "他明确回答 Well done, please。"),
      question("meal-anna", "Anna 的鱼配什么？", [["rice", "米饭和豌豆"], ["potato-salad", "土豆和沙拉"], ["soup", "番茄汤"]], "potato-salad", "Anna 说 with potatoes and a salad。"),
    ],
  },
  {
    id: "doctors-office",
    number: "02",
    englishTitle: "AT THE DOCTOR’S OFFICE",
    chineseTitle: "医生诊室",
    context: "识别症状、持续时间和医生建议。",
    level: "日常",
    duration: "113 秒",
    tone: "blue",
    ...audioMetadata("dialogue_2-02_at_the_doctors_office.mp3", 1814361),
    transcript: [
      line("DOCTOR", "What seems to be the problem?", "你哪里不舒服？", "这是医生询问症状的常见开场。"),
      line("CATHY", "Well, I have a bad cough and a sore throat. I also have a headache.", "我咳嗽得很厉害，嗓子疼，还有头痛。", "cough、sore throat、headache 是三个症状。"),
      line("DOCTOR", "How long have you had these symptoms?", "这些症状持续多久了？", "How long 询问持续时间。"),
      line("CATHY", "About three days now. And I’m really tired, too.", "大约三天了，而且我也非常疲倦。", "three days 是需要抓住的时间信息。"),
      line("DOCTOR", "Hmm. It sounds like you’ve got the flu. Take aspirin every four hours and get plenty of rest. Make sure you drink lots of fluids. Call me if you’re still sick next week.", "听起来像是得了流感。每四小时服一次阿司匹林，多休息，多喝水；如果下周还没好就给我打电话。", "医嘱包含服药频率、休息、补充水分和复诊条件。"),
      line("CATHY", "OK, thanks.", "好的，谢谢。", "简短回应表示接受建议。"),
    ],
    questions: [
      question("doctor-symptom", "Cathy 没有提到哪种症状？", [["cough", "咳嗽"], ["headache", "头痛"], ["stomach", "胃痛"]], "stomach", "她提到咳嗽、嗓子疼、头痛和疲倦，没有提到胃痛。"),
      question("doctor-days", "症状持续了多久？", [["three", "约三天"], ["four", "约四天"], ["week", "一周"]], "three", "Cathy 回答 About three days now。"),
      question("doctor-medicine", "医生建议多久服一次阿司匹林？", [["two-hours", "每两小时"], ["four-hours", "每四小时"], ["daily", "每天一次"]], "four-hours", "医生说 Take aspirin every four hours。"),
    ],
  },
  {
    id: "asking-directions",
    number: "03",
    englishTitle: "ASKING DIRECTIONS",
    chineseTitle: "问路",
    context: "听懂街区数量、转弯方向和地标位置。",
    level: "日常",
    duration: "113 秒",
    tone: "pink",
    ...audioMetadata("dialogue_2-03_asking_directions.mp3", 1799733),
    transcript: [
      line("MARK", "Excuse me. Could you tell me where the library is?", "打扰一下，你能告诉我图书馆在哪里吗？", "Could you tell me… 是礼貌问路句型。"),
      line("NANCY", "Yes, it’s that way. You go three blocks to Washington Street, then turn right. It’s on the corner, across from the bank.", "可以，往那边走。走三个街区到华盛顿街，再右转。图书馆在街角，银行对面。", "顺序是 three blocks、turn right、across from the bank。"),
      line("MARK", "Thanks! I’ve only been in town a few days, so I really don’t know my way around yet.", "谢谢！我来这里只住了几天，所以还不熟悉道路。", "don’t know my way around 表示不熟悉周边道路。"),
      line("NANCY", "Oh, I know how you feel. We moved here a year ago, and I still don’t know where everything is!", "我理解你的感受。我们一年前搬来，我到现在还不知道所有地方在哪儿。", "I know how you feel 用于表达理解和共鸣。"),
    ],
    questions: [
      question("directions-place", "Mark 在找什么地方？", [["library", "图书馆"], ["bank", "银行"], ["post", "邮局"]], "library", "Mark 开头询问 where the library is。"),
      question("directions-turn", "到 Washington Street 后要往哪边转？", [["left", "左转"], ["right", "右转"], ["straight", "直行"]], "right", "Nancy 说 then turn right。"),
      question("directions-landmark", "图书馆在什么地方的对面？", [["hotel", "酒店"], ["bank", "银行"], ["school", "学校"]], "bank", "across from the bank 表示在银行对面。"),
    ],
  },
  {
    id: "calling-for-help",
    number: "04",
    englishTitle: "CALLING FOR HELP",
    chineseTitle: "紧急求助",
    context: "抓住事故、地点和救援安排。",
    level: "进阶",
    duration: "145 秒",
    tone: "green",
    ...audioMetadata("dialogue_2-04_calling_for_help.mp3", 2325504),
    transcript: [
      line("PETER", "Hey! That car just ran a red light and hit that truck!", "嘿！那辆车刚闯红灯撞上了卡车！", "ran a red light 表示闯红灯。"),
      line("GAIL", "Is anyone hurt?", "有人受伤吗？", "hurt 在这里表示受伤。"),
      line("PETER", "I don’t know … let’s call 911. … Hello? I’d like to report a car accident near the post office on Charles Street. It looks like a man is hurt. Yes, it just happened. OK, thanks. Bye.", "我不知道……我们打 911 吧。你好，我要报告一起车祸，地点在查尔斯街邮局附近。看起来有一名男子受伤。是的，刚刚发生。", "报案时依次说明事件、地点、伤情和发生时间。"),
      line("GAIL", "What did they say?", "他们怎么说？", "询问接线员的回应。"),
      line("PETER", "They’re going to send an ambulance and a police car right away.", "他们马上会派一辆救护车和一辆警车。", "right away 表示立刻、马上。"),
      line("GAIL", "Good, they’re here. I hope the man is OK.", "太好了，他们来了。希望那个男人没事。", "they 指前面提到的救援人员。"),
      line("PETER", "I know. You have to be so careful when you’re driving.", "是啊，开车时一定要非常小心。", "have to 强调必须。"),
    ],
    questions: [
      question("help-cause", "事故是怎么发生的？", [["red-light", "汽车闯红灯撞上卡车"], ["truck", "卡车撞上邮局"], ["parking", "停车时剐蹭"]], "red-light", "Peter 说 car ran a red light and hit that truck。"),
      question("help-location", "事故发生在哪里？", [["charles", "Charles Street 邮局附近"], ["washington", "Washington Street 银行附近"], ["mall", "商场附近"]], "charles", "电话中报告 near the post office on Charles Street。"),
      question("help-response", "接线员会派来什么？", [["fire", "消防车"], ["ambulance-police", "救护车和警车"], ["tow", "拖车"]], "ambulance-police", "Peter 说 an ambulance and a police car。"),
    ],
  },
  {
    id: "supermarket",
    number: "05",
    englishTitle: "AT THE SUPERMARKET",
    chineseTitle: "超市采购",
    context: "识别烘焙食材、商品区域和碰面地点。",
    level: "日常",
    duration: "149 秒",
    tone: "orange",
    ...audioMetadata("dialogue_2-05_at_the_supermarket.mp3", 2382078),
    transcript: [
      line("LOUISE", "Hey, Julia … Look at those desserts! How about baking some cookies today?", "Julia，看看那些甜点！今天烤些饼干怎么样？", "How about… 用于提出建议。"),
      line("JULIA", "Hmm … Yeah, that’s a great idea! While we’re here, let’s pick up the ingredients.", "好主意！既然我们在这里，就把食材买齐吧。", "pick up 在这里表示顺便购买。"),
      line("JULIA", "OK, what do we need?", "好，我们需要什么？", "引出接下来的购物清单。"),
      line("LOUISE", "The recipe calls for flour, sugar and butter. Oh, and we also need eggs and chocolate chips.", "配方需要面粉、糖和黄油。对了，还需要鸡蛋和巧克力豆。", "calls for 在食谱中表示需要。"),
      line("JULIA", "Why don’t you get the dairy ingredients? You’ll find those in the refrigerated section in the back of the store. I’ll get the dry ingredients — they’re in aisle 10.", "你去拿乳制品好吗？它们在商店后面的冷藏区。我去拿干货，它们在 10 号通道。", "refrigerated section 与 aisle 10 是两处关键信息。"),
      line("LOUISE", "Great! Let’s meet at the checkout.", "好！我们在收银台碰面。", "checkout 指收银台。"),
      line("JULIA", "OK. See you there.", "好，到时见。", "there 指前一句的 checkout。"),
    ],
    questions: [
      question("market-plan", "她们打算做什么？", [["cookies", "烤饼干"], ["cake", "做蛋糕"], ["salad", "做沙拉"]], "cookies", "Louise 建议 baking some cookies。"),
      question("market-dry", "干货在哪个通道？", [["eight", "8 号"], ["ten", "10 号"], ["twelve", "12 号"]], "ten", "Julia 说 dry ingredients are in aisle 10。"),
      question("market-meet", "两人约在哪里碰面？", [["entrance", "入口"], ["dessert", "甜点区"], ["checkout", "收银台"]], "checkout", "Louise 说 Let’s meet at the checkout。"),
    ],
  },
  {
    id: "running-errands",
    number: "06",
    englishTitle: "RUNNING ERRANDS",
    chineseTitle: "外出办事",
    context: "听懂理发、改裤脚、车辆保养和地点远近。",
    level: "进阶",
    duration: "130 秒",
    tone: "purple",
    ...audioMetadata("dialogue_2-06_running_errands.mp3", 2073078),
    transcript: [
      line("RECEPTIONIST", "Hi, there. How can I help you?", "你好，我能帮你什么？", "服务场景中的常见开场。"),
      line("CLAIRE", "Well, I’m in town visiting for a few days, and I need to get some things done while I’m here.", "我来这里玩几天，期间需要办一些事情。", "get some things done 表示把一些事情办妥。"),
      line("RECEPTIONIST", "Sure. What do you need?", "当然，你需要什么？", "引出具体办事清单。"),
      line("CLAIRE", "I need to get my hair cut. I also need to have my new pants hemmed.", "我需要理发，还需要把新裤子改短。", "get/have something done 表示请别人完成服务。"),
      line("RECEPTIONIST", "OK. Here’s a map of the city. There’s a good hair salon here, which is just a block away. And there’s a tailor right here. Is there anything else?", "这是城市地图。这里有一家不错的美发店，只有一个街区远；这里还有一家裁缝店。还有别的吗？", "hair salon、tailor 和 a block away 是核心信息。"),
      line("CLAIRE", "Yes. I’ll need to have my car serviced before my long drive home!", "有，长途开车回家前我还需要保养汽车。", "have my car serviced 表示送车保养。"),
      line("RECEPTIONIST", "No problem. There’s a good mechanic a few blocks away.", "没问题，几个街区外有一位不错的汽车修理工。", "mechanic 指汽车修理工。"),
    ],
    questions: [
      question("errands-clothes", "Claire 要怎样处理新裤子？", [["clean", "干洗"], ["hem", "改裤脚"], ["return", "退货"]], "hem", "她说 have my new pants hemmed。"),
      question("errands-salon", "美发店有多远？", [["one", "一个街区"], ["few", "几个街区"], ["town", "城外"]], "one", "接待员说 just a block away。"),
      question("errands-car", "Claire 回家前还要做什么？", [["rent", "租车"], ["wash", "洗车"], ["service", "保养汽车"]], "service", "她说 have my car serviced。"),
    ],
  },
  {
    id: "post-office",
    number: "07",
    englishTitle: "AT THE POST OFFICE",
    chineseTitle: "邮局寄件",
    context: "识别包裹重量、寄送方式、到达时间和费用。",
    level: "进阶",
    duration: "106 秒",
    tone: "yellow",
    ...audioMetadata("dialogue_2-07_at_the_post_office.mp3", 1690227),
    transcript: [
      line("CLERK", "What can I do for you today?", "今天需要办理什么？", "柜台服务中的常见问法。"),
      line("CAROL", "I need to mail this package to New York, please.", "我需要把这个包裹寄到纽约。", "mail 作动词表示邮寄。"),
      line("CLERK", "OK, let’s see how much it weighs … it’s about five pounds. If you send it express, it will get there tomorrow. Or you can send it priority and it will get there by Saturday.", "包裹大约五磅。寄特快明天到，寄优先邮件则周六前到。", "注意 express 与 priority 对应不同到达时间。"),
      line("CAROL", "Saturday is fine. How much will that be?", "周六到可以。需要多少钱？", "这句话说明她选择了 priority。"),
      line("CLERK", "$11.35. Do you need anything else?", "11.35 美元。还需要别的吗？", "金额读作 eleven thirty-five。"),
      line("CAROL", "Oh, yeah! I almost forgot. I need a book of stamps, too.", "对了，我差点忘了，我还需要一本邮票。", "a book of stamps 指一册邮票。"),
      line("CLERK", "OK, your total comes to $20.35.", "好的，总计 20.35 美元。", "comes to 用于说明总金额。"),
    ],
    questions: [
      question("post-weight", "包裹大约多重？", [["three", "三磅"], ["five", "五磅"], ["eleven", "十一磅"]], "five", "职员说 it’s about five pounds。"),
      question("post-arrival", "Carol 接受包裹什么时候到达？", [["tomorrow", "明天"], ["friday", "周五"], ["saturday", "周六"]], "saturday", "Carol 回答 Saturday is fine。"),
      question("post-total", "加上邮票后总价是多少？", [["11.35", "$11.35"], ["20.35", "$20.35"], ["21.35", "$21.35"]], "20.35", "最后职员说 total comes to $20.35。"),
    ],
  },
  {
    id: "after-class",
    number: "08",
    englishTitle: "CATCHING UP AFTER CLASS",
    chineseTitle: "课后闲聊",
    context: "听懂考试、展示结果和第二天的学习约定。",
    level: "日常",
    duration: "107 秒",
    tone: "blue",
    ...audioMetadata("dialogue_2-08_catching_up_after_class.mp3", 1711125),
    transcript: [
      line("LINDA", "Hey! How did your physics exam go?", "你的物理考试考得怎么样？", "How did … go? 用于询问事情进展。"),
      line("FRANK", "Not bad, thanks. I’m just glad it’s over! How about you … how’d your presentation go?", "还不错，谢谢。我只是很高兴终于考完了！你呢，你的展示怎么样？", "it’s over 表示已经结束。"),
      line("LINDA", "Oh, it went really well. Thanks for helping me with it!", "非常顺利，谢谢你帮助我！", "went really well 表示进行得很顺利。"),
      line("FRANK", "No problem. So … do you feel like studying tomorrow for our math exam?", "不客气。明天想一起复习数学考试吗？", "feel like doing 表示想做某事。"),
      line("LINDA", "Yeah, sure! Come over around 10:00, after breakfast.", "当然！早餐后十点左右过来吧。", "around 10:00 表示十点左右。"),
      line("FRANK", "All right. I’ll bring my notes.", "好，我会带上笔记。", "notes 是 Frank 要带的物品。"),
    ],
    questions: [
      question("class-exam", "Frank 刚考完什么？", [["physics", "物理"], ["math", "数学"], ["english", "英语"]], "physics", "Linda 开头询问 his physics exam。"),
      question("class-tomorrow", "他们明天准备复习什么？", [["presentation", "课堂展示"], ["physics", "物理考试"], ["math", "数学考试"]], "math", "Frank 提议 studying tomorrow for our math exam。"),
      question("class-time", "他们约在几点左右？", [["eight", "8 点"], ["ten", "10 点"], ["twelve", "12 点"]], "ten", "Linda 说 Come over around 10:00。"),
    ],
  },
  {
    id: "shopping",
    number: "09",
    englishTitle: "SHOPPING",
    chineseTitle: "商店买衣服",
    context: "识别尺码、颜色偏好、试穿结果和含税价格。",
    level: "日常",
    duration: "130 秒",
    tone: "pink",
    ...audioMetadata("dialogue_2-09_shopping.mp3", 2086453),
    transcript: [
      line("SALESPERSON", "Can I help you?", "需要帮忙吗？", "售货员常用的开场问句。"),
      line("GLORIA", "Yes, I’m looking for a sweater — in a size medium.", "我在找一件中码毛衣。", "be looking for 表示正在寻找；medium 是中码。"),
      line("SALESPERSON", "Let’s see … here’s a nice white one. What do you think?", "看看，这里有一件漂亮的白色毛衣。你觉得怎么样？", "one 代指前面的 sweater。"),
      line("GLORIA", "I think I’d rather have it in blue.", "我想我更想要蓝色的。", "would rather 表示更愿意、更偏好。"),
      line("SALESPERSON", "OK … here’s blue, in a medium. Would you like to try it on?", "好的，这件是蓝色中码。你想试穿吗？", "try it on 表示试穿。"),
      line("GLORIA", "OK … yes, I love it. It fits perfectly. How much is it?", "好的，我很喜欢。非常合身。多少钱？", "fits perfectly 表示尺寸完全合适。"),
      line("SALESPERSON", "It’s $50. It will be $53, with tax.", "价格是 50 美元，含税 53 美元。", "with tax 后是实际支付金额。"),
      line("GLORIA", "Perfect! I’ll take it.", "太好了！我要了。", "I’ll take it 表示决定购买。"),
    ],
    questions: [
      question("shopping-size", "Gloria 要什么尺码？", [["small", "小码"], ["medium", "中码"], ["large", "大码"]], "medium", "她说 in a size medium。"),
      question("shopping-color", "Gloria 更喜欢什么颜色？", [["white", "白色"], ["black", "黑色"], ["blue", "蓝色"]], "blue", "她说 I’d rather have it in blue。"),
      question("shopping-total", "含税后需要支付多少钱？", [["50", "$50"], ["53", "$53"], ["55", "$55"]], "53", "售货员说 It will be $53, with tax。"),
    ],
  },
  {
    id: "transportation",
    number: "10",
    englishTitle: "TRANSPORTATION",
    chineseTitle: "乘车去商场",
    context: "听懂交通方式、错过班车和等待时间。",
    level: "日常",
    duration: "148 秒",
    tone: "green",
    ...audioMetadata("dialogue_2-10_transportation.mp3", 2365231),
    transcript: [
      line("JOYCE", "Should we take a taxi or a bus to the mall?", "我们应该坐出租车还是公交车去商场？", "take a taxi/bus 表示乘坐相应交通工具。"),
      line("BILL", "Let’s take a bus. It’s impossible to get a taxi during rush hour.", "坐公交车吧，高峰期根本打不到车。", "rush hour 指上下班交通高峰期。"),
      line("JOYCE", "Isn’t that a bus stop over there?", "那边不是公交车站吗？", "over there 表示在那边。"),
      line("BILL", "Yes ... Oh! There’s a bus now. We’ll have to run to catch it.", "是的……公交车来了，我们得跑过去赶车。", "catch a bus 表示赶上公交车。"),
      line("JOYCE", "Oh, no! We just missed it.", "糟糕！我们刚错过了。", "miss a bus 表示没赶上公交车。"),
      line("BILL", "No problem. There’ll be another one in 10 minutes.", "没关系，十分钟后还有一班。", "in 10 minutes 表示从现在起十分钟后。"),
    ],
    questions: [
      question("transport-choice", "Bill 建议怎样去商场？", [["taxi", "坐出租车"], ["bus", "坐公交车"], ["walk", "步行"]], "bus", "Bill 说 Let’s take a bus。"),
      question("transport-taxi", "为什么不坐出租车？", [["expensive", "价格太贵"], ["rain", "正在下雨"], ["rush", "高峰期打不到车"]], "rush", "Bill 说 impossible to get a taxi during rush hour。"),
      question("transport-next", "下一班公交车多久后到？", [["five", "5 分钟"], ["ten", "10 分钟"], ["twenty", "20 分钟"]], "ten", "Bill 说 another one in 10 minutes。"),
    ],
  },
];

export function getEnglishListeningScene(sceneId) {
  return englishListeningScenes.find((scene) => scene.id === sceneId) ?? null;
}

export function toPublicListeningScene(scene, { includeQuestions = false } = {}) {
  const publicScene = {
    id: scene.id,
    number: scene.number,
    englishTitle: scene.englishTitle,
    chineseTitle: scene.chineseTitle,
    context: scene.context,
    level: scene.level,
    duration: scene.duration,
    tone: scene.tone,
    audioUrl: `/api/english/listening/${encodeURIComponent(scene.id)}/audio`,
    audioSource: {
      title: SOURCE_TITLE,
      publisher: "U.S. Department of State · American English",
      pageUrl: SOURCE_PAGE_URL,
    },
    questionCount: scene.questions.length,
  };

  if (!includeQuestions) return publicScene;
  return {
    ...publicScene,
    questions: scene.questions.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      options: item.options,
    })),
  };
}
