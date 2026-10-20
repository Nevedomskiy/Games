export const ACTIVITIES = {
  animals: { title:'Зверята', subtitle:'Узнай друга по тени', badge:'УЗНАЁМ ЗВЕРЯТ', instruction:'Кто спрятался в тени?', color:'#f6dfd4', items:[
    {id:'bunny',label:'Зайчик',prompt:'Найди зайчика',color:'#f4ddd4'},
    {id:'cat',label:'Котёнок',prompt:'Найди котёнка',color:'#f8e2b6'},
    {id:'dog',label:'Щенок',prompt:'Найди щенка',color:'#f2d6b5'},
    {id:'bear',label:'Медвежонок',prompt:'Найди медвежонка',color:'#e9d5bc'},
    {id:'fox',label:'Лисёнок',prompt:'Найди лисёнка',color:'#f8d5bf'},
    {id:'owl',label:'Совёнок',prompt:'Найди совёнка',color:'#e4dbf2'},
  ]},
  colors: { title:'Цвета',subtitle:'Собери радугу',badge:'ЗНАКОМИМСЯ С ЦВЕТАМИ',instruction:'Найди такой же цвет',color:'#dfeee4',items:[
    {id:'red',label:'Красный',prompt:'Найди красный цвет',color:'#e97f77'},
    {id:'yellow',label:'Жёлтый',prompt:'Найди жёлтый цвет',color:'#f2c75a'},
    {id:'blue',label:'Синий',prompt:'Найди синий цвет',color:'#6998d8'},
    {id:'green',label:'Зелёный',prompt:'Найди зелёный цвет',color:'#82b88b'},
    {id:'purple',label:'Фиолетовый',prompt:'Найди фиолетовый цвет',color:'#ad96cb'},
    {id:'orange',label:'Оранжевый',prompt:'Найди оранжевый цвет',color:'#efa25f'},
  ]},
  shapes: {title:'Формы',subtitle:'Найди фигуру по тени',badge:'ОТКРЫВАЕМ ФОРМЫ',instruction:'Чья это тень?',color:'#e9e0f0',items:[
    {id:'circle',label:'Круг',prompt:'Найди круг',color:'#83b9ac'},
    {id:'square',label:'Квадрат',prompt:'Найди квадрат',color:'#d9a263'},
    {id:'triangle',label:'Треугольник',prompt:'Найди треугольник',color:'#99afd1'},
    {id:'star',label:'Звезда',prompt:'Найди звезду',color:'#e5bf69'},
    {id:'heart',label:'Сердечко',prompt:'Найди сердечко',color:'#d99099'},
    {id:'diamond',label:'Ромб',prompt:'Найди ромб',color:'#b69dcd'},
  ]},
};
export const STICKERS = ['bunny','cat','dog','bear','fox','owl'];
export const SESSION_LENGTH = 5;
export function getItem(mode,id) { return ACTIVITIES[mode]?.items?.find(item=>item.id===id); }
