export const ACTIVITIES = {
  animals: { title:'Зверята', subtitle:'Узнай друга по тени', badge:'УЗНАЁМ ЗВЕРЯТ', instruction:'Кто спрятался в тени?', color:'#f6dfd4', items:[
    {id:'bunny',label:'Зайчик',prompt:'Найди зайчика',color:'#f4ddd4'},
    {id:'cat',label:'Котёнок',prompt:'Найди котёнка',color:'#f8e2b6'},
    {id:'dog',label:'Щенок',prompt:'Найди щенка',color:'#f2d6b5'},
    {id:'bear',label:'Медвежонок',prompt:'Найди медвежонка',color:'#e9d5bc'},
    {id:'fox',label:'Лисёнок',prompt:'Найди лисёнка',color:'#f8d5bf'},
    {id:'owl',label:'Совёнок',prompt:'Найди совёнка',color:'#e4dbf2'},
    {id:'frog',label:'Лягушка',prompt:'Найди лягушку',color:'#dcebcf'},
    {id:'bee',label:'Пчела',prompt:'Найди пчелу',color:'#f1e6bd'},
    {id:'squirrel',label:'Белочка',prompt:'Найди белочку',color:'#e8d5c0'},
    {id:'monkey',label:'Обезьянка',prompt:'Найди обезьянку',color:'#eadbc6'},
  ]},
  colors: { title:'Цвета',subtitle:'Собери радугу',badge:'ЗНАКОМИМСЯ С ЦВЕТАМИ',instruction:'Найди такой же цвет',color:'#dfeee4',items:[
    {id:'red',label:'Красный',prompt:'Найди красный цвет',color:'#e97f77'},
    {id:'yellow',label:'Жёлтый',prompt:'Найди жёлтый цвет',color:'#f2c75a'},
    {id:'blue',label:'Синий',prompt:'Найди синий цвет',color:'#6998d8'},
    {id:'green',label:'Зелёный',prompt:'Найди зелёный цвет',color:'#82b88b'},
    {id:'purple',label:'Фиолетовый',prompt:'Найди фиолетовый цвет',color:'#ad96cb'},
    {id:'orange',label:'Оранжевый',prompt:'Найди оранжевый цвет',color:'#efa25f'},
    {id:'pink',label:'Розовый',prompt:'Найди розовый цвет',color:'#e8a7c8'},
    {id:'brown',label:'Коричневый',prompt:'Найди коричневый цвет',color:'#997456'},
    {id:'white',label:'Белый',prompt:'Найди белый цвет',color:'#ffffff'},
    {id:'black',label:'Чёрный',prompt:'Найди чёрный цвет',color:'#353944'},
  ]},
  shapes: {title:'Формы',subtitle:'Найди фигуру по тени',badge:'ОТКРЫВАЕМ ФОРМЫ',instruction:'Чья это тень?',color:'#e9e0f0',items:[
    {id:'circle',label:'Круг',prompt:'Найди круг',color:'#83b9ac'},
    {id:'square',label:'Квадрат',prompt:'Найди квадрат',color:'#d9a263'},
    {id:'triangle',label:'Треугольник',prompt:'Найди треугольник',color:'#99afd1'},
    {id:'star',label:'Звезда',prompt:'Найди звезду',color:'#e5bf69'},
    {id:'heart',label:'Сердечко',prompt:'Найди сердечко',color:'#d99099'},
    {id:'diamond',label:'Ромб',prompt:'Найди ромб',color:'#b69dcd'},
    {id:'oval',label:'Овал',prompt:'Найди овал',color:'#83b9ac'},
    {id:'rectangle',label:'Прямоугольник',prompt:'Найди прямоугольник',color:'#d9a263'},
    {id:'semicircle',label:'Полукруг',prompt:'Найди полукруг',color:'#99afd1'},
    {id:'trapezoid',label:'Трапеция',prompt:'Найди трапецию',color:'#b69dcd'},
  ]},
};
ACTIVITIES.puzzles = {
  title:'Пазлы',subtitle:'Собери зверёнка из 4 частей',badge:'СОБИРАЕМ ПАЗЛЫ',instruction:'Собери зверёнка',color:'#e8e2f2',
  items:ACTIVITIES.animals.items,
};
ACTIVITIES.homes = {
  title:'Чей домик?',subtitle:'Помоги друзьям найти дом',badge:'ЗНАКОМИМСЯ С ДОМИКАМИ',instruction:'Где живёт наш друг?',color:'#e0ebdc',items:[
    {id:'frog',label:'Лягушка',answerId:'pond',answerLabel:'Пруд',prompt:'Где живёт лягушка? Найди её домик.',fact:'Лягушку можно встретить у пруда.'},
    {id:'bee',label:'Пчела',answerId:'hive',answerLabel:'Улей',prompt:'Найди домик пчелы.',fact:'Пчёлы живут в улье.'},
    {id:'bird',label:'Птичка',answerId:'nest',answerLabel:'Гнездо',prompt:'Где птичка растит птенцов?',fact:'Птичка растит птенцов в гнезде.'},
    {id:'squirrel',label:'Белочка',answerId:'hollow',answerLabel:'Дупло',prompt:'Найди домик белочки в дереве.',fact:'Белочка может устроить домик в дупле.'},
    {id:'dog',label:'Щенок',answerId:'kennel',answerLabel:'Будка',prompt:'Какой домик построили для щенка?',fact:'Для щенка построили будку.'},
    {id:'ant',label:'Муравей',answerId:'anthill',answerLabel:'Муравейник',prompt:'Найди домик муравья.',fact:'Муравьи живут в муравейнике.'},
    {id:'fish',label:'Рыбка',answerId:'aquarium',answerLabel:'Аквариум',prompt:'Какой домик приготовили для рыбки?',fact:'Для рыбки приготовили аквариум.'},
    {id:'beaver',label:'Бобр',answerId:'lodge',answerLabel:'Хатка',prompt:'Найди хатку бобра из веточек у воды.',fact:'Бобр построил хатку из веточек.'},
    {id:'bat',label:'Летучая мышь',answerId:'cave',answerLabel:'Пещера',prompt:'Где летучая мышь может отдохнуть днём?',fact:'Летучая мышь может отдыхать в пещере.'},
    {id:'spider',label:'Паучок',answerId:'web',answerLabel:'Паутинка',prompt:'Найди паутинку паучка.',fact:'Паучок сплёл паутинку.'},
  ],
};
ACTIVITIES.foods = {
  title:'Кто что любит?',subtitle:'Подбери вкусное угощение',badge:'УГОЩАЕМ ДРУЗЕЙ',instruction:'Чем угостим нашего друга?',color:'#f4e5cc',items:[
    {id:'monkey',label:'Обезьянка',answerId:'banana',answerLabel:'Банан',prompt:'Найди банан для обезьянки.',fact:'Угостим обезьянку бананом.'},
    {id:'bunny',label:'Зайчик',answerId:'carrot',answerLabel:'Морковка',prompt:'Найди угощение для зайчика.',fact:'Угостим зайчика морковкой.'},
    {id:'squirrel',label:'Белочка',answerId:'acorn',answerLabel:'Жёлудь',prompt:'Что любит белочка?',fact:'Белочке подойдёт жёлудь.'},
    {id:'cow',label:'Корова',answerId:'grass',answerLabel:'Трава',prompt:'Найди еду для коровы.',fact:'Корова ест траву.'},
    {id:'bee',label:'Пчела',answerId:'flower',answerLabel:'Нектар цветка',prompt:'Где пчела найдёт сладкий нектар?',fact:'Пчела собирает нектар с цветка.'},
    {id:'cat',label:'Котёнок',answerId:'fish',answerLabel:'Рыбка',prompt:'Выбери угощение для котёнка.',fact:'Котёнку подойдёт рыбка.'},
    {id:'panda',label:'Панда',answerId:'bamboo',answerLabel:'Бамбук',prompt:'Найди бамбук для панды.',fact:'Панда ест бамбук.'},
    {id:'horse',label:'Лошадка',answerId:'hay',answerLabel:'Сено',prompt:'Чем угостим лошадку?',fact:'Лошадке подойдёт сено.'},
    {id:'goat',label:'Козочка',answerId:'cabbage',answerLabel:'Капуста',prompt:'Найди угощение для козочки.',fact:'Угостим козочку капустой.'},
    {id:'chick',label:'Цыплёнок',answerId:'grain',answerLabel:'Зёрнышки',prompt:'Чем угостим цыплёнка?',fact:'Цыплёнок клюёт зёрнышки.'},
  ],
};
export const PUZZLE_PARTS = ['0','1','2','3'];
export const PIECE_LABELS = ['Верхняя левая часть','Верхняя правая часть','Нижняя левая часть','Нижняя правая часть'];
export const STICKERS = ['bunny','cat','dog','bear','fox','owl'];
// Do not offer other familiar edible foods as an incorrect answer.
const OTHER_FOODS = {
  monkey:['carrot','acorn','fish','bamboo','cabbage','grain'],
  bunny:['grass','hay','cabbage','grain','banana'], squirrel:['banana','carrot','grain','cabbage'],
  cow:['hay','grain','cabbage','carrot','banana'], bee:[], cat:[],
  panda:['carrot','grass','hay','grain','cabbage','banana'],
  horse:['grass','carrot','cabbage','grain','banana'],
  goat:['carrot','grass','hay','grain','bamboo','banana','acorn'], chick:['grass','cabbage','carrot','banana'],
};
for(const item of ACTIVITIES.foods.items)item.alsoEats=OTHER_FOODS[item.id];
export const SESSION_LENGTH = 10;
export function getItem(mode,id) { return ACTIVITIES[mode]?.items?.find(item=>item.id===id); }
export function choiceLabel(mode,id) {const item=getItem(mode,id);return item?.answerLabel||item?.label||'';}
