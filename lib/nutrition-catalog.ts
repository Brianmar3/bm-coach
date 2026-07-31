import type {
  NutritionIngredient,
  NutritionRecipeResult,
} from "../types/nutrition-intelligence.ts";

export type NutritionBudgetLevel = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH";

type IngredientDefinition = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  aliases: string[];
};

type RecipeSpec = {
  id: string;
  title: string;
  mealTypes: string[];
  essential: string[];
  optional?: string[];
  tags: string[];
  budget: NutritionBudgetLevel;
  minutes: number;
  equipment: string[];
  protein?: string;
  method: string;
  reusable?: boolean;
};

const ingredientRows: Array<[string, string, number, string, string[]?]> = [
  ["arroz", "Cereales y legumbres", 80, "g", ["arroz blanco", "arroz integral", "arroz cocido"]],
  ["huevo", "Proteínas", 2, "unidades", ["huevos", "huevo duro", "huevo revuelto"]],
  ["avena", "Cereales y legumbres", 50, "g", ["avena arrollada"]],
  ["pan", "Cereales y legumbres", 2, "rebanadas", ["pan integral", "pan lactal", "tostadas"]],
  ["tortilla de trigo", "Cereales y legumbres", 2, "unidades", ["wrap", "rapidita", "tortilla para wrap"]],
  ["fideos", "Cereales y legumbres", 90, "g", ["pasta", "tallarines", "tirabuzones"]],
  ["polenta", "Cereales y legumbres", 80, "g", ["harina de maíz"]],
  ["papa", "Frutas y verduras", 2, "unidades", ["papas", "patata", "patatas"]],
  ["batata", "Frutas y verduras", 1, "unidad", ["batatas", "boniato"]],
  ["lenteja", "Cereales y legumbres", 200, "g", ["lentejas", "lentejas cocidas"]],
  ["garbanzo", "Cereales y legumbres", 200, "g", ["garbanzos", "garbanzos cocidos"]],
  ["poroto", "Cereales y legumbres", 200, "g", ["porotos", "frijol", "frijoles", "alubias"]],
  ["arveja", "Cereales y legumbres", 150, "g", ["arvejas", "guisantes"]],
  ["harina", "Cereales y legumbres", 100, "g", ["harina común", "harina integral"]],
  ["harina de garbanzo", "Cereales y legumbres", 80, "g", []],
  ["maicena", "Almacén", 20, "g", ["fécula de maíz"]],
  ["sémola", "Cereales y legumbres", 80, "g", []],
  ["cuscús", "Cereales y legumbres", 80, "g", ["cous cous", "couscous"]],
  ["tapa de tarta", "Cereales y legumbres", 1, "unidad", ["masa de tarta"]],
  ["tapa de empanada", "Cereales y legumbres", 4, "unidades", ["masa de empanada"]],
  ["pollo", "Proteínas", 150, "g", ["pechuga", "pata muslo", "pollo cocido"]],
  ["carne vacuna", "Proteínas", 150, "g", ["carne", "carne picada", "nalga", "cuadrada", "roast beef"]],
  ["cerdo", "Proteínas", 150, "g", ["carne de cerdo", "bondiola", "lomo de cerdo"]],
  ["merluza", "Proteínas", 160, "g", ["pescado", "filet de merluza"]],
  ["atún", "Proteínas", 1, "lata", ["atun", "atún al natural"]],
  ["sardina", "Proteínas", 1, "lata", ["sardinas"]],
  ["queso", "Lácteos", 50, "g", ["queso fresco", "queso cremoso", "muzzarella"]],
  ["ricota", "Lácteos", 100, "g", ["requesón"]],
  ["yogur", "Lácteos", 180, "g", ["yogurt", "yogur natural"]],
  ["leche", "Lácteos", 200, "ml", ["leche descremada", "leche entera"]],
  ["tofu", "Proteínas", 150, "g", []],
  ["soja texturizada", "Proteínas", 80, "g", ["proteína de soja texturizada"]],
  ["jamón cocido", "Proteínas", 60, "g", ["jamon", "jamón"]],
  ["tomate", "Frutas y verduras", 1, "unidad", ["tomates", "tomate perita"]],
  ["tomate triturado", "Almacén", 200, "ml", ["puré de tomate", "salsa de tomate"]],
  ["cebolla", "Frutas y verduras", 1, "unidad", ["cebollas"]],
  ["cebolla de verdeo", "Frutas y verduras", 1, "unidad", ["verdeo"]],
  ["ajo", "Frutas y verduras", 1, "diente", ["dientes de ajo"]],
  ["zanahoria", "Frutas y verduras", 1, "unidad", ["zanahorias"]],
  ["zapallito", "Frutas y verduras", 1, "unidad", ["zapallitos", "zucchini", "calabacín"]],
  ["zapallo", "Frutas y verduras", 250, "g", ["calabaza", "anco"]],
  ["berenjena", "Frutas y verduras", 1, "unidad", ["berenjenas"]],
  ["morrón", "Frutas y verduras", 1, "unidad", ["morron", "pimiento", "ají morrón"]],
  ["acelga", "Frutas y verduras", 1, "atado", []],
  ["espinaca", "Frutas y verduras", 150, "g", ["espinacas"]],
  ["repollo", "Frutas y verduras", 150, "g", ["col"]],
  ["lechuga", "Frutas y verduras", 100, "g", ["hojas verdes"]],
  ["pepino", "Frutas y verduras", 1, "unidad", ["pepinos"]],
  ["brócoli", "Frutas y verduras", 200, "g", ["brocoli"]],
  ["coliflor", "Frutas y verduras", 200, "g", []],
  ["chaucha", "Frutas y verduras", 150, "g", ["chauchas", "judías verdes"]],
  ["choclo", "Frutas y verduras", 1, "unidad", ["maíz", "maiz"]],
  ["remolacha", "Frutas y verduras", 1, "unidad", ["remolachas"]],
  ["rúcula", "Frutas y verduras", 50, "g", ["rucula"]],
  ["apio", "Frutas y verduras", 1, "tallo", []],
  ["puerro", "Frutas y verduras", 1, "unidad", []],
  ["champignon", "Frutas y verduras", 150, "g", ["champiñón", "hongos"]],
  ["palta", "Frutas y verduras", 0.5, "unidad", ["aguacate"]],
  ["banana", "Frutas y verduras", 1, "unidad", ["bananas", "plátano"]],
  ["manzana", "Frutas y verduras", 1, "unidad", ["manzanas"]],
  ["pera", "Frutas y verduras", 1, "unidad", ["peras"]],
  ["naranja", "Frutas y verduras", 1, "unidad", ["naranjas"]],
  ["mandarina", "Frutas y verduras", 2, "unidades", ["mandarinas"]],
  ["frutilla", "Frutas y verduras", 150, "g", ["frutillas", "fresa", "fresas"]],
  ["durazno", "Frutas y verduras", 1, "unidad", ["duraznos", "melocotón"]],
  ["ciruela", "Frutas y verduras", 2, "unidades", ["ciruelas"]],
  ["uva", "Frutas y verduras", 150, "g", ["uvas"]],
  ["kiwi", "Frutas y verduras", 1, "unidad", ["kiwis"]],
  ["limón", "Frutas y verduras", 1, "unidad", ["limon", "limones"]],
  ["melón", "Frutas y verduras", 200, "g", ["melon"]],
  ["sandía", "Frutas y verduras", 250, "g", ["sandia"]],
  ["maní", "Almacén", 20, "g", ["mani", "cacahuate"]],
  ["nuez", "Almacén", 20, "g", ["nueces"]],
  ["almendra", "Almacén", 20, "g", ["almendras"]],
  ["semilla de girasol", "Almacén", 15, "g", ["semillas de girasol"]],
  ["semilla de chía", "Almacén", 10, "g", ["chia", "chía"]],
  ["semilla de lino", "Almacén", 10, "g", ["lino"]],
  ["pasta de maní", "Almacén", 1, "cucharada", ["mantequilla de maní"]],
  ["aceite", "Almacén", 1, "cucharadita", ["aceite común", "aceite de girasol", "aceite de oliva"]],
  ["vinagre", "Almacén", 1, "cucharada", ["vinagre de alcohol", "vinagre de manzana"]],
  ["mayonesa", "Almacén", 1, "cucharada", []],
  ["mostaza", "Almacén", 1, "cucharadita", []],
  ["miel", "Almacén", 1, "cucharadita", []],
  ["mermelada", "Almacén", 1, "cucharada", []],
  ["cacao", "Almacén", 1, "cucharada", ["cacao amargo"]],
  ["canela", "Condimentos", 1, "pizca", []],
  ["pimentón", "Condimentos", 1, "pizca", ["pimenton"]],
  ["orégano", "Condimentos", 1, "pizca", ["oregano"]],
  ["comino", "Condimentos", 1, "pizca", []],
  ["curry", "Condimentos", 1, "pizca", []],
  ["perejil", "Condimentos", 1, "cucharada", []],
  ["albahaca", "Condimentos", 1, "cucharada", []],
  ["sal", "Condimentos", 1, "pizca", []],
  ["pimienta", "Condimentos", 1, "pizca", []],
  ["agua", "Almacén", 250, "ml", []],
  ["caldo", "Almacén", 250, "ml", ["caldo casero"]],
  ["leche vegetal", "Lácteos", 200, "ml", ["bebida vegetal"]],
  ["queso untable", "Lácteos", 40, "g", ["queso crema"]],
  ["dulce de leche", "Almacén", 1, "cucharada", []],
  ["granola", "Cereales y legumbres", 40, "g", []],
  ["galleta de arroz", "Cereales y legumbres", 3, "unidades", ["galletas de arroz"]],
  ["tortilla de maíz", "Cereales y legumbres", 3, "unidades", ["taco", "tacos"]],
  ["puré de papa", "Frutas y verduras", 250, "g", ["pure de papa"]],
  ["puré de zapallo", "Frutas y verduras", 250, "g", ["pure de calabaza"]],
  ["arroz inflado", "Cereales y legumbres", 30, "g", []],
  ["copos de maíz", "Cereales y legumbres", 40, "g", ["cereal de maíz"]],
  ["coco rallado", "Almacén", 15, "g", []],
  ["pasas", "Almacén", 20, "g", ["pasas de uva"]],
  ["aceituna", "Almacén", 30, "g", ["aceitunas"]],
  ["caballa", "Proteínas", 1, "lata", []],
  ["carne de pollo desmenuzada", "Proteínas", 150, "g", ["pollo desmenuzado"]],
  ["poroto de soja", "Cereales y legumbres", 150, "g", ["soja cocida"]],
  ["zapallo cabutia", "Frutas y verduras", 250, "g", ["cabutia"]],
  ["rabanito", "Frutas y verduras", 4, "unidades", ["rabanitos"]],
  ["alcaucil", "Frutas y verduras", 2, "unidades", ["alcachofa"]],
  ["quinoa", "Cereales y legumbres", 80, "g", []],
];

export const INGREDIENT_CATALOG: IngredientDefinition[] = ingredientRows.map(
  ([name, category, quantity, unit, aliases = []]) => ({
    name,
    category,
    quantity,
    unit,
    aliases,
  }),
);

const recipeSpecs: RecipeSpec[] = [
  { id: "arroz-huevo-revuelto", title: "Arroz con huevo revuelto", mealTypes: ["almuerzo", "cena"], essential: ["arroz", "huevo"], optional: ["cebolla de verdeo"], tags: ["económica", "rápida"], budget: "VERY_LOW", minutes: 12, equipment: ["sartén"], protein: "huevo", method: "salteado", reusable: true },
  { id: "arroz-salteado-huevo", title: "Arroz salteado con huevo", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["arroz", "huevo"], optional: ["zanahoria", "arveja"], tags: ["económica", "reutilizable"], budget: "VERY_LOW", minutes: 15, equipment: ["sartén"], protein: "huevo", method: "salteado", reusable: true },
  { id: "tortilla-arroz-huevo", title: "Tortilla de arroz y huevo", mealTypes: ["almuerzo", "cena"], essential: ["arroz", "huevo"], optional: ["queso", "perejil"], tags: ["económica", "pocos ingredientes"], budget: "VERY_LOW", minutes: 18, equipment: ["sartén"], protein: "huevo", method: "tortilla" },
  { id: "croquetas-arroz-huevo", title: "Croquetas simples de arroz y huevo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["arroz", "huevo"], optional: ["harina", "queso"], tags: ["económica", "para llevar"], budget: "VERY_LOW", minutes: 25, equipment: ["sartén"], protein: "huevo", method: "dorado" },
  { id: "bowl-arroz-huevo", title: "Bowl tibio de arroz y huevo", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["arroz", "huevo"], optional: ["tomate", "zanahoria"], tags: ["económica", "rápida"], budget: "VERY_LOW", minutes: 12, equipment: ["olla"], protein: "huevo", method: "bowl" },
  { id: "arroz-huevo-duro", title: "Arroz con huevo duro y condimentos", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["arroz", "huevo"], optional: ["mostaza", "perejil"], tags: ["económica", "para llevar"], budget: "VERY_LOW", minutes: 15, equipment: ["olla"], protein: "huevo", method: "hervido", reusable: true },
  { id: "tostadas-huevo-tomate", title: "Tostadas con huevo y tomate", mealTypes: ["desayuno", "merienda", "preentrenamiento"], essential: ["pan", "huevo"], optional: ["tomate"], tags: ["rápida"], budget: "LOW", minutes: 10, equipment: ["sartén"], protein: "huevo", method: "tostado" },
  { id: "tostadas-ricota-fruta", title: "Tostadas con ricota y fruta", mealTypes: ["desayuno", "merienda"], essential: ["pan", "ricota", "banana"], optional: ["canela"], tags: ["rápida"], budget: "LOW", minutes: 8, equipment: [], protein: "ricota", method: "sin cocinar" },
  { id: "tostadas-queso-manzana", title: "Tostadas con queso y manzana", mealTypes: ["desayuno", "merienda", "para llevar"], essential: ["pan", "queso", "manzana"], tags: ["para llevar"], budget: "LOW", minutes: 7, equipment: [], protein: "queso", method: "sin cocinar" },
  { id: "avena-banana-canela", title: "Avena cocida con banana y canela", mealTypes: ["desayuno", "merienda", "preentrenamiento"], essential: ["avena", "leche", "banana"], optional: ["canela"], tags: ["económica"], budget: "VERY_LOW", minutes: 10, equipment: ["olla"], protein: "leche", method: "cocido" },
  { id: "avena-manzana", title: "Avena con manzana salteada", mealTypes: ["desayuno", "merienda"], essential: ["avena", "leche", "manzana"], optional: ["canela"], tags: ["económica"], budget: "LOW", minutes: 14, equipment: ["olla"], protein: "leche", method: "cocido" },
  { id: "avena-nocturna-pera", title: "Avena nocturna con pera", mealTypes: ["desayuno", "merienda", "para llevar"], essential: ["avena", "yogur", "pera"], optional: ["semilla de chía"], tags: ["para llevar", "sin cocinar"], budget: "LOW", minutes: 7, equipment: ["heladera"], protein: "yogur", method: "sin cocinar" },
  { id: "yogur-fruta-granola", title: "Yogur con fruta y granola", mealTypes: ["desayuno", "merienda", "postentrenamiento"], essential: ["yogur", "banana", "granola"], optional: ["cacao"], tags: ["sin cocinar", "rápida"], budget: "MODERATE", minutes: 5, equipment: [], protein: "yogur", method: "sin cocinar" },
  { id: "yogur-avena-manzana", title: "Yogur con avena y manzana", mealTypes: ["desayuno", "merienda", "para llevar"], essential: ["yogur", "avena", "manzana"], optional: ["canela"], tags: ["para llevar"], budget: "LOW", minutes: 5, equipment: [], protein: "yogur", method: "sin cocinar" },
  { id: "panqueques-avena-banana", title: "Panqueques de avena y banana", mealTypes: ["desayuno", "merienda", "preentrenamiento"], essential: ["avena", "banana", "huevo"], optional: ["canela"], tags: ["sin horno"], budget: "LOW", minutes: 15, equipment: ["sartén"], protein: "huevo", method: "plancha" },
  { id: "panqueques-harina-leche", title: "Panqueques simples con fruta", mealTypes: ["desayuno", "merienda"], essential: ["harina", "leche", "huevo"], optional: ["banana", "manzana"], tags: ["económica"], budget: "VERY_LOW", minutes: 18, equipment: ["sartén"], protein: "huevo", method: "plancha" },
  { id: "omelette-queso", title: "Omelette de queso", mealTypes: ["desayuno", "almuerzo", "cena"], essential: ["huevo", "queso"], optional: ["tomate", "espinaca"], tags: ["rápida", "sin horno"], budget: "LOW", minutes: 12, equipment: ["sartén"], protein: "huevo", method: "tortilla" },
  { id: "omelette-vegetales", title: "Omelette con vegetales", mealTypes: ["desayuno", "almuerzo", "cena"], essential: ["huevo", "zapallito"], optional: ["cebolla", "morrón"], tags: ["rápida"], budget: "LOW", minutes: 15, equipment: ["sartén"], protein: "huevo", method: "tortilla" },
  { id: "sandwich-huevo", title: "Sándwich de huevo y tomate", mealTypes: ["desayuno", "merienda", "almuerzo", "para llevar"], essential: ["pan", "huevo"], optional: ["tomate", "lechuga"], tags: ["para llevar", "económica"], budget: "LOW", minutes: 12, equipment: [], protein: "huevo", method: "sándwich" },
  { id: "sandwich-pollo", title: "Sándwich de pollo desmenuzado", mealTypes: ["almuerzo", "cena", "para llevar", "postentrenamiento"], essential: ["pan", "carne de pollo desmenuzada"], optional: ["tomate", "mostaza"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 10, equipment: [], protein: "pollo", method: "sándwich", reusable: true },
  { id: "sandwich-atun", title: "Sándwich de atún y vegetales", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["pan", "atún"], optional: ["tomate", "zanahoria"], tags: ["para llevar", "sin cocinar"], budget: "MODERATE", minutes: 10, equipment: [], protein: "atún", method: "sándwich" },
  { id: "licuado-banana-avena", title: "Licuado de banana y avena", mealTypes: ["desayuno", "merienda", "preentrenamiento", "postentrenamiento"], essential: ["banana", "leche", "avena"], optional: ["cacao"], tags: ["rápida", "para llevar"], budget: "LOW", minutes: 5, equipment: ["licuadora"], protein: "leche", method: "licuado" },
  { id: "licuado-frutilla-yogur", title: "Licuado de frutilla y yogur", mealTypes: ["desayuno", "merienda", "postentrenamiento"], essential: ["frutilla", "yogur", "leche"], optional: ["avena"], tags: ["rápida"], budget: "MODERATE", minutes: 5, equipment: ["licuadora"], protein: "yogur", method: "licuado" },
  { id: "galletas-arroz-queso", title: "Galletas de arroz con queso y fruta", mealTypes: ["merienda", "preentrenamiento", "para llevar"], essential: ["galleta de arroz", "queso", "banana"], tags: ["sin cocinar", "para llevar"], budget: "LOW", minutes: 4, equipment: [], protein: "queso", method: "sin cocinar" },
  { id: "arroz-pollo-vegetales", title: "Arroz con pollo y vegetales", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["arroz", "pollo"], optional: ["zanahoria", "zapallito", "cebolla"], tags: ["reutilizable", "económica"], budget: "LOW", minutes: 30, equipment: ["olla", "sartén"], protein: "pollo", method: "salteado", reusable: true },
  { id: "arroz-carne", title: "Arroz salteado con carne", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["arroz", "carne vacuna"], optional: ["morrón", "cebolla"], tags: ["completa"], budget: "MODERATE", minutes: 28, equipment: ["sartén"], protein: "carne vacuna", method: "salteado" },
  { id: "arroz-lentejas", title: "Arroz con lentejas y vegetales", mealTypes: ["almuerzo", "cena"], essential: ["arroz", "lenteja"], optional: ["cebolla", "zanahoria"], tags: ["vegetariana", "económica", "reutilizable"], budget: "VERY_LOW", minutes: 25, equipment: ["olla"], protein: "lenteja", method: "olla", reusable: true },
  { id: "arroz-garbanzos", title: "Arroz con garbanzos especiados", mealTypes: ["almuerzo", "cena"], essential: ["arroz", "garbanzo"], optional: ["cebolla", "pimentón"], tags: ["vegetariana", "económica"], budget: "VERY_LOW", minutes: 22, equipment: ["sartén"], protein: "garbanzo", method: "salteado" },
  { id: "arroz-atun", title: "Ensalada de arroz y atún", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["arroz", "atún"], optional: ["tomate", "choclo"], tags: ["para llevar", "reutilizable"], budget: "MODERATE", minutes: 18, equipment: ["olla"], protein: "atún", method: "ensalada", reusable: true },
  { id: "fideos-salsa-huevo", title: "Fideos con salsa y huevo", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["fideos", "tomate triturado", "huevo"], optional: ["queso"], tags: ["económica"], budget: "VERY_LOW", minutes: 20, equipment: ["olla"], protein: "huevo", method: "pasta" },
  { id: "fideos-pollo", title: "Fideos salteados con pollo", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["fideos", "pollo"], optional: ["zapallito", "zanahoria"], tags: ["reutilizable"], budget: "LOW", minutes: 25, equipment: ["olla", "sartén"], protein: "pollo", method: "salteado" },
  { id: "fideos-atun-tomate", title: "Fideos con atún y tomate", mealTypes: ["almuerzo", "cena"], essential: ["fideos", "atún", "tomate triturado"], optional: ["cebolla"], tags: ["rápida"], budget: "MODERATE", minutes: 20, equipment: ["olla"], protein: "atún", method: "pasta" },
  { id: "fideos-lentejas", title: "Fideos con salsa de lentejas", mealTypes: ["almuerzo", "cena"], essential: ["fideos", "lenteja", "tomate triturado"], optional: ["zanahoria"], tags: ["vegetariana", "económica"], budget: "VERY_LOW", minutes: 28, equipment: ["olla"], protein: "lenteja", method: "pasta", reusable: true },
  { id: "polenta-salsa-huevo", title: "Polenta con salsa y huevo", mealTypes: ["almuerzo", "cena"], essential: ["polenta", "tomate triturado", "huevo"], optional: ["queso"], tags: ["muy económica", "olla"], budget: "VERY_LOW", minutes: 20, equipment: ["olla"], protein: "huevo", method: "olla" },
  { id: "polenta-carne", title: "Polenta con salsa de carne", mealTypes: ["almuerzo", "cena"], essential: ["polenta", "tomate triturado", "carne vacuna"], optional: ["cebolla"], tags: ["rendidora"], budget: "LOW", minutes: 30, equipment: ["olla"], protein: "carne vacuna", method: "olla", reusable: true },
  { id: "polenta-lentejas", title: "Polenta con salsa de lentejas", mealTypes: ["almuerzo", "cena"], essential: ["polenta", "tomate triturado", "lenteja"], optional: ["cebolla"], tags: ["vegetariana", "muy económica"], budget: "VERY_LOW", minutes: 28, equipment: ["olla"], protein: "lenteja", method: "olla", reusable: true },
  { id: "tortilla-papa", title: "Tortilla de papa", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["papa", "huevo"], optional: ["cebolla"], tags: ["económica", "para llevar"], budget: "VERY_LOW", minutes: 30, equipment: ["sartén"], protein: "huevo", method: "tortilla", reusable: true },
  { id: "tortilla-batata", title: "Tortilla de batata", mealTypes: ["almuerzo", "cena"], essential: ["batata", "huevo"], optional: ["cebolla"], tags: ["económica"], budget: "LOW", minutes: 30, equipment: ["sartén"], protein: "huevo", method: "tortilla" },
  { id: "papa-rellena-pollo", title: "Papa rellena de pollo", mealTypes: ["almuerzo", "cena"], essential: ["papa", "carne de pollo desmenuzada"], optional: ["queso", "cebolla"], tags: ["reutilizable"], budget: "LOW", minutes: 35, equipment: ["horno"], protein: "pollo", method: "horno" },
  { id: "papa-rellena-lentejas", title: "Papa rellena de lentejas", mealTypes: ["almuerzo", "cena"], essential: ["papa", "lenteja"], optional: ["queso", "cebolla"], tags: ["vegetariana", "económica"], budget: "VERY_LOW", minutes: 35, equipment: ["horno"], protein: "lenteja", method: "horno" },
  { id: "pure-pollo", title: "Pollo con puré de papa", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pollo", "puré de papa"], optional: ["zanahoria"], tags: ["clásica"], budget: "LOW", minutes: 35, equipment: ["olla", "sartén"], protein: "pollo", method: "plancha" },
  { id: "pure-carne", title: "Carne con puré de zapallo", mealTypes: ["almuerzo", "cena"], essential: ["carne vacuna", "puré de zapallo"], optional: ["cebolla"], tags: ["clásica"], budget: "MODERATE", minutes: 35, equipment: ["olla", "sartén"], protein: "carne vacuna", method: "plancha" },
  { id: "guiso-lentejas", title: "Guiso de lentejas", mealTypes: ["almuerzo", "cena"], essential: ["lenteja", "tomate triturado"], optional: ["arroz", "cebolla", "zanahoria", "papa"], tags: ["muy económica", "rendidora", "reutilizable"], budget: "VERY_LOW", minutes: 40, equipment: ["olla"], protein: "lenteja", method: "olla", reusable: true },
  { id: "guiso-arroz-pollo", title: "Guiso de arroz y pollo", mealTypes: ["almuerzo", "cena"], essential: ["arroz", "pollo", "tomate triturado"], optional: ["zanahoria", "arveja"], tags: ["rendidora", "reutilizable"], budget: "LOW", minutes: 38, equipment: ["olla"], protein: "pollo", method: "olla", reusable: true },
  { id: "guiso-fideos-carne", title: "Guiso de fideos y carne", mealTypes: ["almuerzo", "cena"], essential: ["fideos", "carne vacuna", "tomate triturado"], optional: ["papa", "zanahoria"], tags: ["rendidora"], budget: "LOW", minutes: 40, equipment: ["olla"], protein: "carne vacuna", method: "olla", reusable: true },
  { id: "sopa-zapallo", title: "Sopa cremosa de zapallo", mealTypes: ["almuerzo", "cena"], essential: ["zapallo", "cebolla", "caldo"], optional: ["queso"], tags: ["vegetariana", "económica"], budget: "VERY_LOW", minutes: 30, equipment: ["olla", "licuadora"], method: "sopa", reusable: true },
  { id: "sopa-verduras-lentejas", title: "Sopa de verduras y lentejas", mealTypes: ["almuerzo", "cena"], essential: ["lenteja", "caldo"], optional: ["zanahoria", "puerro", "zapallo"], tags: ["vegetariana", "rendidora"], budget: "VERY_LOW", minutes: 35, equipment: ["olla"], protein: "lenteja", method: "sopa", reusable: true },
  { id: "ensalada-garbanzos", title: "Ensalada completa de garbanzos", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["garbanzo", "tomate"], optional: ["zanahoria", "pepino", "lechuga"], tags: ["vegetariana", "para llevar"], budget: "LOW", minutes: 15, equipment: [], protein: "garbanzo", method: "ensalada" },
  { id: "ensalada-lentejas-huevo", title: "Ensalada de lentejas y huevo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["lenteja", "huevo"], optional: ["tomate", "zanahoria"], tags: ["económica", "para llevar"], budget: "VERY_LOW", minutes: 15, equipment: ["olla"], protein: "huevo", method: "ensalada" },
  { id: "ensalada-papa-atun", title: "Ensalada de papa y atún", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["papa", "atún"], optional: ["huevo", "tomate"], tags: ["para llevar"], budget: "MODERATE", minutes: 25, equipment: ["olla"], protein: "atún", method: "ensalada" },
  { id: "ensalada-arroz-pollo", title: "Ensalada de arroz y pollo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["arroz", "pollo"], optional: ["tomate", "zanahoria", "choclo"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 20, equipment: ["olla"], protein: "pollo", method: "ensalada", reusable: true },
  { id: "tarta-acelga", title: "Tarta casera de acelga", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de tarta", "acelga", "huevo"], optional: ["queso", "cebolla"], tags: ["económica", "reutilizable"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "huevo", method: "horno", reusable: true },
  { id: "tarta-zapallito", title: "Tarta de zapallito y queso", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de tarta", "zapallito", "huevo"], optional: ["queso", "cebolla"], tags: ["reutilizable"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "huevo", method: "horno", reusable: true },
  { id: "tarta-pollo", title: "Tarta de pollo y verduras", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de tarta", "carne de pollo desmenuzada"], optional: ["cebolla", "morrón", "huevo"], tags: ["reutilizable", "para llevar"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "pollo", method: "horno", reusable: true },
  { id: "tarta-atun", title: "Tarta de atún y tomate", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de tarta", "atún", "tomate"], optional: ["cebolla", "huevo"], tags: ["para llevar"], budget: "MODERATE", minutes: 40, equipment: ["horno"], protein: "atún", method: "horno" },
  { id: "wrap-pollo", title: "Wrap de pollo y vegetales", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tortilla de trigo", "pollo"], optional: ["tomate", "lechuga", "zanahoria"], tags: ["para llevar", "rápida"], budget: "LOW", minutes: 15, equipment: [], protein: "pollo", method: "wrap" },
  { id: "wrap-huevo", title: "Wrap de huevo y tomate", mealTypes: ["desayuno", "almuerzo", "cena", "para llevar"], essential: ["tortilla de trigo", "huevo"], optional: ["tomate", "queso"], tags: ["para llevar", "económica"], budget: "LOW", minutes: 12, equipment: ["sartén"], protein: "huevo", method: "wrap" },
  { id: "wrap-garbanzos", title: "Wrap de garbanzos pisados", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tortilla de trigo", "garbanzo"], optional: ["tomate", "repollo"], tags: ["vegetariana", "para llevar"], budget: "LOW", minutes: 12, equipment: [], protein: "garbanzo", method: "wrap" },
  { id: "milanesa-pollo-horno", title: "Milanesa de pollo al horno con papa", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pollo", "harina", "huevo", "papa"], optional: ["tomate"], tags: ["horno"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "pollo", method: "horno" },
  { id: "milanesa-carne-horno", title: "Milanesa de carne al horno con ensalada", mealTypes: ["almuerzo", "cena"], essential: ["carne vacuna", "harina", "huevo"], optional: ["lechuga", "tomate"], tags: ["horno"], budget: "MODERATE", minutes: 40, equipment: ["horno"], protein: "carne vacuna", method: "horno" },
  { id: "hamburguesa-lentejas", title: "Hamburguesas caseras de lentejas", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["lenteja", "avena"], optional: ["cebolla", "zanahoria"], tags: ["vegetariana", "económica", "reutilizable"], budget: "VERY_LOW", minutes: 35, equipment: ["sartén"], protein: "lenteja", method: "plancha", reusable: true },
  { id: "hamburguesa-carne", title: "Hamburguesa casera con vegetales", mealTypes: ["almuerzo", "cena"], essential: ["carne vacuna", "pan"], optional: ["tomate", "lechuga", "cebolla"], tags: ["casera"], budget: "MODERATE", minutes: 25, equipment: ["sartén"], protein: "carne vacuna", method: "plancha" },
  { id: "hamburguesa-pollo", title: "Hamburguesa casera de pollo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["pollo", "avena"], optional: ["zanahoria", "cebolla"], tags: ["reutilizable"], budget: "LOW", minutes: 30, equipment: ["sartén"], protein: "pollo", method: "plancha", reusable: true },
  { id: "salteado-pollo-papa", title: "Salteado de pollo y papa", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pollo", "papa"], optional: ["cebolla", "morrón"], tags: ["sin horno"], budget: "LOW", minutes: 28, equipment: ["sartén"], protein: "pollo", method: "salteado" },
  { id: "salteado-carne-verduras", title: "Salteado de carne y verduras", mealTypes: ["almuerzo", "cena"], essential: ["carne vacuna", "zapallito"], optional: ["morrón", "cebolla", "arroz"], tags: ["sin horno"], budget: "MODERATE", minutes: 25, equipment: ["sartén"], protein: "carne vacuna", method: "salteado" },
  { id: "salteado-tofu-arroz", title: "Salteado de tofu y arroz", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["tofu", "arroz"], optional: ["zanahoria", "zapallito"], tags: ["vegetariana"], budget: "MODERATE", minutes: 25, equipment: ["sartén"], protein: "tofu", method: "salteado" },
  { id: "revuelto-zapallito", title: "Revuelto de zapallito y huevo", mealTypes: ["almuerzo", "cena"], essential: ["zapallito", "huevo"], optional: ["cebolla", "queso"], tags: ["económica", "rápida"], budget: "VERY_LOW", minutes: 18, equipment: ["sartén"], protein: "huevo", method: "revuelto" },
  { id: "revuelto-acelga", title: "Revuelto de acelga y huevo", mealTypes: ["almuerzo", "cena"], essential: ["acelga", "huevo"], optional: ["cebolla", "queso"], tags: ["económica"], budget: "VERY_LOW", minutes: 20, equipment: ["sartén"], protein: "huevo", method: "revuelto" },
  { id: "merluza-papa", title: "Merluza a la plancha con papa", mealTypes: ["almuerzo", "cena"], essential: ["merluza", "papa"], optional: ["limón", "tomate"], tags: ["simple"], budget: "MODERATE", minutes: 30, equipment: ["sartén", "olla"], protein: "merluza", method: "plancha" },
  { id: "merluza-pure", title: "Merluza al horno con puré de zapallo", mealTypes: ["almuerzo", "cena"], essential: ["merluza", "puré de zapallo"], optional: ["limón"], tags: ["horno"], budget: "MODERATE", minutes: 35, equipment: ["horno"], protein: "merluza", method: "horno" },
  { id: "pollo-horno-batata", title: "Pollo al horno con batata", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pollo", "batata"], optional: ["cebolla", "morrón"], tags: ["reutilizable", "horno"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "pollo", method: "horno", reusable: true },
  { id: "pollo-olla-verduras", title: "Pollo a la olla con verduras", mealTypes: ["almuerzo", "cena"], essential: ["pollo", "tomate triturado"], optional: ["papa", "zanahoria", "cebolla"], tags: ["rendidora", "reutilizable"], budget: "LOW", minutes: 40, equipment: ["olla"], protein: "pollo", method: "olla", reusable: true },
  { id: "pastel-papa-carne", title: "Pastel de papa y carne", mealTypes: ["almuerzo", "cena"], essential: ["papa", "carne vacuna"], optional: ["cebolla", "huevo"], tags: ["rendidora", "reutilizable"], budget: "LOW", minutes: 50, equipment: ["horno"], protein: "carne vacuna", method: "horno", reusable: true },
  { id: "pastel-papa-lentejas", title: "Pastel de papa y lentejas", mealTypes: ["almuerzo", "cena"], essential: ["papa", "lenteja"], optional: ["cebolla", "zanahoria"], tags: ["vegetariana", "muy económica", "reutilizable"], budget: "VERY_LOW", minutes: 50, equipment: ["horno"], protein: "lenteja", method: "horno", reusable: true },
  { id: "berenjena-rellena-carne", title: "Berenjena rellena de carne", mealTypes: ["almuerzo", "cena"], essential: ["berenjena", "carne vacuna"], optional: ["tomate triturado", "queso"], tags: ["horno"], budget: "MODERATE", minutes: 40, equipment: ["horno"], protein: "carne vacuna", method: "horno" },
  { id: "zapallito-relleno-arroz", title: "Zapallitos rellenos de arroz y huevo", mealTypes: ["almuerzo", "cena"], essential: ["zapallito", "arroz", "huevo"], optional: ["queso"], tags: ["económica", "horno"], budget: "LOW", minutes: 40, equipment: ["horno"], protein: "huevo", method: "horno" },
  { id: "empanadas-pollo", title: "Empanadas caseras de pollo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de empanada", "carne de pollo desmenuzada"], optional: ["cebolla", "morrón", "huevo"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 45, equipment: ["horno"], protein: "pollo", method: "horno", reusable: true },
  { id: "empanadas-lentejas", title: "Empanadas de lentejas", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["tapa de empanada", "lenteja"], optional: ["cebolla", "morrón"], tags: ["vegetariana", "económica", "para llevar"], budget: "VERY_LOW", minutes: 45, equipment: ["horno"], protein: "lenteja", method: "horno", reusable: true },
  { id: "banana-pasta-mani", title: "Banana con pasta de maní", mealTypes: ["merienda", "preentrenamiento", "postentrenamiento"], essential: ["banana", "pasta de maní"], optional: ["canela"], tags: ["sin cocinar", "rápida"], budget: "LOW", minutes: 3, equipment: [], protein: "maní", method: "sin cocinar" },
  { id: "banana-yogur", title: "Banana con yogur", mealTypes: ["desayuno", "merienda", "preentrenamiento", "postentrenamiento"], essential: ["banana", "yogur"], optional: ["avena"], tags: ["sin cocinar", "rápida"], budget: "LOW", minutes: 3, equipment: [], protein: "yogur", method: "sin cocinar" },
  { id: "fruta-queso", title: "Fruta fresca con queso", mealTypes: ["merienda", "preentrenamiento", "para llevar"], essential: ["manzana", "queso"], optional: ["galleta de arroz"], tags: ["sin cocinar", "para llevar"], budget: "LOW", minutes: 4, equipment: [], protein: "queso", method: "sin cocinar" },
  { id: "tostada-pasta-banana", title: "Tostada con pasta de maní y banana", mealTypes: ["desayuno", "merienda", "preentrenamiento"], essential: ["pan", "pasta de maní", "banana"], tags: ["rápida"], budget: "LOW", minutes: 5, equipment: ["tostadora"], protein: "maní", method: "tostado" },
  { id: "leche-banana", title: "Leche con banana y cacao", mealTypes: ["desayuno", "merienda", "postentrenamiento"], essential: ["leche", "banana"], optional: ["cacao", "avena"], tags: ["rápida", "económica"], budget: "LOW", minutes: 5, equipment: ["licuadora"], protein: "leche", method: "licuado" },
  { id: "yogur-manzana", title: "Yogur con manzana y canela", mealTypes: ["desayuno", "merienda", "para llevar"], essential: ["yogur", "manzana"], optional: ["canela", "avena"], tags: ["sin cocinar", "para llevar"], budget: "LOW", minutes: 5, equipment: [], protein: "yogur", method: "sin cocinar" },
  { id: "huevo-duro-pan", title: "Huevo duro con pan y fruta", mealTypes: ["desayuno", "merienda", "preentrenamiento", "para llevar"], essential: ["huevo", "pan", "naranja"], tags: ["para llevar", "económica"], budget: "LOW", minutes: 12, equipment: ["olla"], protein: "huevo", method: "hervido" },
  { id: "sandwich-queso-tomate", title: "Sándwich de queso y tomate", mealTypes: ["desayuno", "merienda", "almuerzo", "para llevar"], essential: ["pan", "queso", "tomate"], optional: ["rúcula"], tags: ["sin cocinar", "para llevar"], budget: "LOW", minutes: 6, equipment: [], protein: "queso", method: "sándwich" },
  { id: "garbanzos-tomate-huevo", title: "Garbanzos salteados con tomate y huevo", mealTypes: ["almuerzo", "cena"], essential: ["garbanzo", "huevo"], optional: ["tomate", "cebolla"], tags: ["económica"], budget: "LOW", minutes: 18, equipment: ["sartén"], protein: "huevo", method: "salteado" },
  { id: "porotos-arroz", title: "Porotos con arroz", mealTypes: ["almuerzo", "cena"], essential: ["poroto", "arroz"], optional: ["tomate triturado", "cebolla"], tags: ["vegetariana", "muy económica", "rendidora"], budget: "VERY_LOW", minutes: 25, equipment: ["olla"], protein: "poroto", method: "olla", reusable: true },
  { id: "porotos-polenta", title: "Porotos guisados con polenta", mealTypes: ["almuerzo", "cena"], essential: ["poroto", "polenta", "tomate triturado"], optional: ["cebolla"], tags: ["vegetariana", "muy económica"], budget: "VERY_LOW", minutes: 30, equipment: ["olla"], protein: "poroto", method: "olla", reusable: true },
  { id: "caballa-arroz", title: "Arroz con caballa y tomate", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["arroz", "caballa"], optional: ["tomate", "choclo"], tags: ["para llevar"], budget: "MODERATE", minutes: 18, equipment: ["olla"], protein: "caballa", method: "ensalada" },
  { id: "sardinas-pan-tomate", title: "Tostadas con sardinas y tomate", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pan", "sardina"], optional: ["tomate", "limón"], tags: ["rápida"], budget: "MODERATE", minutes: 8, equipment: [], protein: "sardina", method: "tostado" },
  { id: "soja-bolognesa", title: "Fideos con boloñesa de soja", mealTypes: ["almuerzo", "cena"], essential: ["fideos", "soja texturizada", "tomate triturado"], optional: ["cebolla", "zanahoria"], tags: ["vegetariana", "económica"], budget: "LOW", minutes: 28, equipment: ["olla"], protein: "soja", method: "pasta", reusable: true },
  { id: "tofu-verduras", title: "Tofu salteado con verduras", mealTypes: ["almuerzo", "cena"], essential: ["tofu", "zapallito"], optional: ["zanahoria", "morrón", "arroz"], tags: ["vegetariana"], budget: "MODERATE", minutes: 22, equipment: ["sartén"], protein: "tofu", method: "salteado" },
  { id: "ensalada-remolacha-huevo", title: "Ensalada de remolacha, papa y huevo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["remolacha", "papa", "huevo"], optional: ["zanahoria"], tags: ["económica", "para llevar"], budget: "VERY_LOW", minutes: 28, equipment: ["olla"], protein: "huevo", method: "ensalada" },
  { id: "chauchas-papa-huevo", title: "Chauchas con papa y huevo", mealTypes: ["almuerzo", "cena"], essential: ["chaucha", "papa", "huevo"], optional: ["tomate"], tags: ["económica"], budget: "LOW", minutes: 28, equipment: ["olla"], protein: "huevo", method: "ensalada" },
  { id: "zapallo-arroz-lentejas", title: "Zapallo relleno de arroz y lentejas", mealTypes: ["almuerzo", "cena"], essential: ["zapallo", "arroz", "lenteja"], optional: ["queso", "cebolla"], tags: ["vegetariana", "rendidora"], budget: "LOW", minutes: 50, equipment: ["horno"], protein: "lenteja", method: "horno", reusable: true },
  { id: "cuscus-garbanzos", title: "Cuscús con garbanzos y vegetales", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["cuscús", "garbanzo"], optional: ["tomate", "pepino", "zanahoria"], tags: ["vegetariana", "para llevar"], budget: "MODERATE", minutes: 15, equipment: ["olla"], protein: "garbanzo", method: "ensalada" },
  { id: "arroz-leche-fruta", title: "Arroz con leche y fruta", mealTypes: ["desayuno", "merienda", "postentrenamiento"], essential: ["arroz", "leche"], optional: ["banana", "canela"], tags: ["económica", "reutilizable"], budget: "VERY_LOW", minutes: 30, equipment: ["olla"], protein: "leche", method: "cocido", reusable: true },
  { id: "budin-avena-banana", title: "Budín simple de avena y banana", mealTypes: ["desayuno", "merienda", "para llevar"], essential: ["avena", "banana", "huevo"], optional: ["cacao", "canela"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 40, equipment: ["horno"], protein: "huevo", method: "horno", reusable: true },
  { id: "muffins-huevo-verduras", title: "Muffins de huevo y verduras", mealTypes: ["desayuno", "merienda", "almuerzo", "para llevar"], essential: ["huevo", "zapallito"], optional: ["queso", "morrón"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 30, equipment: ["horno"], protein: "huevo", method: "horno", reusable: true },
  { id: "ensalada-pollo-repollo", title: "Ensalada de pollo y repollo", mealTypes: ["almuerzo", "cena", "para llevar"], essential: ["pollo", "repollo"], optional: ["zanahoria", "manzana"], tags: ["para llevar", "reutilizable"], budget: "LOW", minutes: 18, equipment: [], protein: "pollo", method: "ensalada" },
  { id: "tacos-carne", title: "Tacos caseros de carne", mealTypes: ["almuerzo", "cena"], essential: ["tortilla de maíz", "carne vacuna"], optional: ["tomate", "repollo", "cebolla"], tags: ["sin horno"], budget: "MODERATE", minutes: 25, equipment: ["sartén"], protein: "carne vacuna", method: "tacos" },
  { id: "tacos-porotos", title: "Tacos de porotos y vegetales", mealTypes: ["almuerzo", "cena"], essential: ["tortilla de maíz", "poroto"], optional: ["tomate", "repollo", "cebolla"], tags: ["vegetariana", "económica"], budget: "LOW", minutes: 20, equipment: ["sartén"], protein: "poroto", method: "tacos" },
  { id: "pollo-arvejas-arroz", title: "Pollo con arvejas y arroz", mealTypes: ["almuerzo", "cena", "postentrenamiento"], essential: ["pollo", "arveja", "arroz"], optional: ["cebolla", "zanahoria"], tags: ["rendidora", "reutilizable"], budget: "LOW", minutes: 32, equipment: ["olla"], protein: "pollo", method: "olla", reusable: true },
  { id: "carne-papa-olla", title: "Carne a la olla con papa", mealTypes: ["almuerzo", "cena"], essential: ["carne vacuna", "papa"], optional: ["cebolla", "zanahoria", "tomate triturado"], tags: ["rendidora"], budget: "MODERATE", minutes: 50, equipment: ["olla"], protein: "carne vacuna", method: "olla", reusable: true },
  { id: "cerdo-batata", title: "Cerdo a la plancha con batata", mealTypes: ["almuerzo", "cena"], essential: ["cerdo", "batata"], optional: ["cebolla", "morrón"], tags: ["simple"], budget: "MODERATE", minutes: 30, equipment: ["sartén"], protein: "cerdo", method: "plancha" },
];

const ingredientByName = new Map(
  INGREDIENT_CATALOG.map((item) => [item.name, item]),
);

function catalogIngredient(name: string, optional = false): NutritionIngredient {
  const definition = ingredientByName.get(name);
  if (!definition) throw new Error(`Ingrediente de catálogo inexistente: ${name}`);
  return {
    name: definition.name,
    quantity: definition.quantity,
    unit: definition.unit,
    category: definition.category,
    optional,
  };
}

const budgetLabels: Record<NutritionBudgetLevel, string> = {
  VERY_LOW: "Muy económica",
  LOW: "Económica",
  MODERATE: "Moderada",
  HIGH: "Más costosa",
};

export const NUTRITION_RECIPE_CATALOG: NutritionRecipeResult[] = recipeSpecs.map(
  (spec) => ({
    id: spec.id,
    title: spec.title,
    description: `${spec.title}: una preparación realista con ingredientes habituales en Argentina.`,
    servings: 1,
    preparationMinutes: spec.minutes,
    difficulty: spec.minutes > 40 ? "Intermedia" : "Fácil",
    ingredients: [
      ...spec.essential.map((name) => catalogIngredient(name)),
      ...(spec.optional ?? []).map((name) => catalogIngredient(name, true)),
    ],
    essentialIngredients: spec.essential,
    optionalIngredients: spec.optional ?? [],
    steps: [
      `Prepará los ingredientes principales para ${spec.title.toLocaleLowerCase("es-AR")}.`,
      `Cociná usando el método ${spec.method}, controlando el punto de cocción.`,
      "Integrá los ingredientes opcionales que tengas y condimentá de forma simple.",
    ],
    equipment: spec.equipment,
    substitutions: [],
    rationale:
      spec.budget === "VERY_LOW" || spec.budget === "LOW"
        ? "Usa ingredientes rendidores y fáciles de reutilizar durante la semana."
        : "Aporta variedad con ingredientes disponibles habitualmente en comercios argentinos.",
    warnings: [],
    tags: [
      ...spec.tags,
      ...spec.mealTypes,
      `presupuesto:${spec.budget.toLocaleLowerCase()}`,
      `catalog:${spec.id}`,
    ],
    mealTypes: spec.mealTypes,
    budgetLevel: spec.budget,
    region: "AR",
    objectiveTags: ["mejorar hábitos", "mantener", "rendimiento"],
    trainingTags: spec.mealTypes.filter((item) => item.includes("entrenamiento")),
    mainProtein: spec.protein ?? "",
    cookingMethod: spec.method,
    reusable: spec.reusable ?? false,
  }),
);

export function nutritionCatalogStats() {
  return {
    recipes: NUTRITION_RECIPE_CATALOG.length,
    ingredients: INGREDIENT_CATALOG.length,
  };
}

export function catalogRecipesByTitles(titles: string[]) {
  const wanted = new Set(titles.map((title) => title.trim().toLocaleLowerCase("es-AR")));
  return NUTRITION_RECIPE_CATALOG.filter((recipe) =>
    wanted.has(recipe.title.toLocaleLowerCase("es-AR")),
  );
}

export function budgetLabel(level: NutritionBudgetLevel | undefined) {
  return level ? budgetLabels[level] : "Sin especificar";
}
