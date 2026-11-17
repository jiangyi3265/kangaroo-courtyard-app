export const truths=[
  '最近一次让你开心的小事是什么？','你最想再去一次的城市是哪座？','旅行时，你更喜欢计划还是随心？','如果能放假一个月，你会怎样安排？','你最近学会的一件事是什么？','你最拿手的一道菜是什么？','你理想中的一天是什么样？','你印象最深的一次迷路经历是什么？','你最想学会哪项新技能？','你小时候梦想过做什么工作？','你出门必带的一件东西是什么？','说一个你愿意分享的小习惯。','你最喜欢和朋友一起做什么？','你最喜欢哪种天气？','你想给一年前的自己什么建议？','有什么事情你曾经不敢做，现在敢了？','你最想体验的一种生活方式是什么？','你觉得今天在场谁最有幽默感？为什么？','你收到过最有心意的礼物是什么？','推荐一部让你难忘的电影或一本书。'
]
export const dares=[
  '用三种语气向大家打招呼。','模仿一种小动物，让大家猜。','用一句话给今天的聚会起个名字。','用肢体比划一种交通工具。','在30秒内说出五个城市的名字。','唱两句自己喜欢的歌，不想唱也可以哼旋律。','为手边一件物品设计一句广告词。','用播音员的语气介绍自己。','闭眼画一只袋鼠，展示给大家看。','夸赞在场的一位朋友，内容具体一点。','用表情演绎“错过最后一班车”。','在30秒内说出五种旅行用品。','把“今天的风很舒服”说成绕口令。','用三个动作介绍自己的职业或爱好。','拍手打出一段节奏，请大家跟上。','不说话，比划你最喜欢的食物。','给在场所有人一个友好的击掌邀请，可选择不接。','用三个词总结你的最近一周。','用慢动作表演收拾旅行箱。','用一句话邀请大家去你的家乡旅行。'
]
export function drawCard(kind,seen=[],random=Math.random){
  const deck=kind==='dare'?dares:truths
  let available=deck.map((_,i)=>i).filter(i=>!seen.includes(i))
  const reset=!available.length;if(reset)available=deck.map((_,i)=>i)
  const index=available[Math.min(available.length-1,Math.floor(random()*available.length))]
  return {index,text:deck[index],seen:reset?[index]:[...seen,index]}
}
export function rollDice(count,random=Math.random){return Array.from({length:Math.max(1,Math.min(6,Math.floor(Number(count)||1)))},()=>1+Math.min(5,Math.floor(random()*6)))}
export const remainingSeconds=(deadline,now=Date.now())=>Math.max(0,Math.ceil((deadline-now)/1000))
