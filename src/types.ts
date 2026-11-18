export type Tab='home'|'market'|'zono'|'official'|'repair'|'pc'|'os'|'ship'|'bank'|'biz'|'black'|'settings';
export type Source='market'|'zono'|'official'|'black';
export type Item={id:number;name:string;category:string;base:number;condition:'new'|'used';defect?:boolean;listPrice?:number;purchasePrice?:number;listedOn?:Source;pcPart?:string;brand?:string;speed?:number;reliability?:number;warrantyDays?:number;warrantyUntil?:number;broken?:boolean};
export type Review={id:number;platform:'market'|'zono';stars:number;text:string;author:string;kind:'bot'|'player';day:number};
export type Offer={id:number;itemId:number;buyer:string;price:number;platform:'market'|'zono';expires:number};
export type Shipment={id:number;item:string;status:'В пути'|'Доставлено';days:number};
export type OsProject={name:string;version:string;kernel:string;features:string[];createdDay:number};
export type Save={cash:number;day:number;hour:number;goal:number;mode:'30d'|'360d'|'free';inventory:Item[];reviews:Review[];offers:Offer[];shipments:Shipment[];pcParts:Record<string,Item>;wanted:number;promoUsed:string[];reputation:number;dailyProfit:number;bizIncome:number;deposit:number;loan:number;returns:number;osProjects:OsProject[];settings:{autosave:boolean}};
