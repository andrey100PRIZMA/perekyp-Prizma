import type {Item,Offer,Review,Save,OsProject} from './types';
export const KEY='perekup-react-final-v6';
export const PC_PARTS=[['cpu','Процессор',12500,'CPU'],['gpu','Видеокарта',23500,'GPU'],['ram','ОЗУ 16GB',4200,'RAM'],['board','Материнская плата',8500,'BOARD'],['ssd','SSD 500GB',3900,'SSD'],['psu','Блок питания 650W',5200,'PSU'],['case','Корпус Airflow',4800,'CASE'],['cooler','Кулер Tower',3500,'COOLER']] as const;
export const SSD_CATALOG=[
 {name:'Kingston NV2 500GB',brand:'Kingston',speed:3500,price:3900,reliability:72},
 {name:'WD Blue SN580 1TB',brand:'Western Digital',speed:4150,price:6200,reliability:84},
 {name:'Samsung 990 PRO 1TB',brand:'Samsung',speed:7450,price:12500,reliability:96},
 {name:'Crucial P3 Plus 1TB',brand:'Crucial',speed:5000,price:5600,reliability:79},
 {name:'NoName TurboSSD 1TB',brand:'NoName',speed:2800,price:2600,reliability:48}
];
export const CPU_CATALOG=[
 ['Intel Core i3-6100',4500],['Intel Core i5-9400F',8500],['AMD Ryzen 5 3600',9000],['AMD Ryzen 5 5600',12500],['Intel Core i5-12400F',17500],['AMD Ryzen 7 7800X3D',36500],['Intel Core i9-14900K',48000]
] as const;
export const GPU_CATALOG=[
 ['GTX 1060 6GB',9000],['GTX 1660 Super',15000],['RTX 2060',17000],['RTX 3060 12GB',23500],['RTX 4060',31000],['RTX 4070 Super',58000],['RTX 4080 Super',98000]
] as const;
let seed=1000; const id=()=>seed++;
export function money(n:number){return Math.round(n).toLocaleString('ru-RU')+' ₽'}
const names=['iPhone 13','iPhone 12','Samsung Galaxy S23','PS5','MacBook Air','AirPods Pro','Dyson','Nintendo Switch','Apple Watch'];
const cats=['Телефоны','Телефоны','Телефоны','Игры','Ноутбуки','Аудио','Техника','Игры','Носимые'];
export function makeItem(i=0):Item{const base=[32000,25000,48000,42000,65000,18000,35000,30000,22000][i%9];return{id:id(),name:names[i%9],category:cats[i%9],base,condition:'used',defect:Math.random()<.28,purchasePrice:Math.round(base*.75),reliability:75}}
export function initialSave():Save{return{cash:50000,day:1,hour:12,goal:100000,mode:'30d',inventory:[makeItem(0),makeItem(3)],reviews:[],offers:[],shipments:[],pcParts:{},wanted:0,promoUsed:[],reputation:5,dailyProfit:0,bizIncome:0,deposit:0,loan:0,returns:0,osProjects:[],settings:{autosave:true}}}
export function normalizeSave(raw:Partial<Save>):Save{const base=initialSave();const s={...base,...raw};s.inventory=(raw.inventory||base.inventory).map(i=>({...i,purchasePrice:i.purchasePrice??Math.round((i.listPrice??i.base)*.75),reliability:i.reliability??75}));s.reviews=raw.reviews||[];s.offers=raw.offers||[];s.shipments=raw.shipments||[];s.pcParts=raw.pcParts||{};s.promoUsed=raw.promoUsed||[];s.osProjects=raw.osProjects||[];s.settings={autosave:true,...(raw.settings||{})};return s}
export function loadLocal():Save|null{try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&typeof x.cash==='number'?normalizeSave(x):null}catch{return null}}
export function saveLocal(s:Save){try{localStorage.setItem(KEY,JSON.stringify(s));localStorage.setItem(KEY+'_backup',JSON.stringify({ts:Date.now(),data:s}))}catch{} }
export function makeOffers(item:Item,s:Save,platform:'market'|'zono'):Offer[]{const reviewBoost=Math.min(.25,s.reviews.filter(r=>r.platform===platform).length*.01);const market=item.base*(item.defect?.7:1);return[0,1,2].map((_,i)=>({id:id(),itemId:item.id,buyer:['Алексей','Мария','Дмитрий'][i],price:Math.max(100,Math.round(market*(.88+i*.08+reviewBoost))),platform,expires:s.day+1}))}
export function reviewAverage(s:Save,p:'market'|'zono'){const a=s.reviews.filter(r=>r.platform===p);return a.length?a.reduce((x,r)=>x+r.stars,0)/a.length:5}
export function createOS(name:string,kernel:string,features:string[],day:number):OsProject{return{name:name.trim()||'MyOS',version:'1.0',kernel,features,createdDay:day}}
