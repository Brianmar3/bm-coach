export type CuratedRecipe = {
  description: string;
  servings: number;
  prep: number;
  cook: number;
  rest?: number;
  ingredients: Array<[name: string, quantity: number, unit: "g" | "ml" | "unidades", state?: string, optional?: true]>;
  steps: string[];
  substitutions: Array<[ingredient: string, replacement: string]>;
  tags: string[];
};

export const CURATED_RECIPES: Readonly<Partial<Record<string, CuratedRecipe>>> = {
  "tostadas-huevo-tomate": {
    description: "Tostadas crocantes con huevo revuelto y tomate fresco.",
    servings: 2, prep: 5, cook: 5,
    ingredients: [["pan", 4, "unidades", "rebanadas"], ["huevo", 4, "unidades"], ["tomate", 160, "g"], ["aceite", 5, "ml", undefined, true]],
    steps: ["Lavá el tomate con agua segura, cortalo en láminas y tostá el pan.", "Batí los huevos y volcá en una sartén antiadherente a fuego bajo.", "Revolvé hasta que el huevo quede firme, sin partes líquidas. Serví enseguida.", "Repartí el huevo y el tomate sobre las tostadas."],
    substitutions: [["tomate", "morrón asado"], ["pan", "pan integral"]],
    tags: ["rápida", "económica", "vegetariana"],
  },
  "tostadas-ricota-fruta": {
    description: "Ricota cremosa y banana fresca sobre tostadas para desayuno o merienda.",
    servings: 2, prep: 6, cook: 2,
    ingredients: [["pan", 4, "unidades", "rebanadas"], ["ricota", 120, "g"], ["banana", 160, "g", "sin cáscara"], ["canela", 1, "g", undefined, true]],
    steps: ["Tostá el pan en tostadora o sartén seca.", "Retirá la ricota pasteurizada de la heladera al momento de usarla y pisala con un tenedor.", "Cortá la banana en rodajas finas.", "Untá las tostadas y repartí la banana. Terminá con canela si querés."],
    substitutions: [["banana", "pera madura"], ["ricota", "queso untable"]],
    tags: ["rápida", "sin horno"],
  },
  "avena-banana-canela": {
    description: "Avena cremosa con banana pisada y un toque de canela.",
    servings: 2, prep: 4, cook: 8,
    ingredients: [["avena", 80, "g", "seca"], ["leche", 360, "ml"], ["banana", 160, "g", "sin cáscara"], ["canela", 1, "g", undefined, true]],
    steps: ["Pelá la banana, pisá la mitad y cortá el resto en rodajas.", "Calentá la leche pasteurizada con la avena en una olla chica.", "Cociná 6–8 minutos a fuego bajo y revolvé hasta que espese.", "Fuera del fuego, mezclá la banana pisada y serví con las rodajas."],
    substitutions: [["banana", "pera madura pisada"], ["leche", "leche sin lactosa"]],
    tags: ["económica", "rápida", "vegetariana"],
  },
  "avena-nocturna-pera": {
    description: "Avena fría con yogur y pera, preparada la noche anterior.",
    servings: 2, prep: 8, cook: 0, rest: 360,
    ingredients: [["avena", 80, "g", "seca"], ["yogur", 300, "g"], ["pera", 180, "g", "sin semillas ni corazón"], ["agua", 60, "ml", undefined, true], ["semilla de chía", 8, "g", undefined, true]],
    steps: ["Mezclá la avena con el yogur en recipientes con tapa.", "Si queda muy espesa, repartí el agua y mezclá.", "Tapá y refrigerá de inmediato a menos de 5 °C durante al menos 6 horas.", "Lavá la pera con agua segura y cortala al servir. Agregá chía si querés. Si llevás la avena, usá una bolsa térmica con refrigerante."],
    substitutions: [["pera", "manzana rallada"], ["yogur", "yogur sin lactosa"]],
    tags: ["para llevar", "sin cocinar"],
  },
  "panqueques-avena-banana": {
    description: "Panqueques chicos de banana y avena, dorados en sartén.",
    servings: 2, prep: 8, cook: 12,
    ingredients: [["avena", 60, "g", "seca"], ["banana", 140, "g", "sin cáscara"], ["huevo", 2, "unidades"], ["aceite", 5, "ml", undefined, true], ["canela", 1, "g", undefined, true]],
    steps: ["Pisá la banana y batila con los huevos.", "Mezclá con la avena y dejá reposar 3 minutos.", "Volcá cucharadas de mezcla en una sartén a fuego medio-bajo.", "Dá vuelta cuando los bordes estén firmes. Cociná hasta que el centro esté firme y sin mezcla líquida. Para media unidad de huevo, batí un huevo y usá la mitad."],
    substitutions: [["canela", "esencia de vainilla"]],
    tags: ["sin horno", "vegetariana"],
  },
  "licuado-banana-avena": {
    description: "Licuado espeso de banana y avena para una merienda rápida.",
    servings: 2, prep: 6, cook: 0,
    ingredients: [["banana", 200, "g", "sin cáscara"], ["leche", 400, "ml"], ["avena", 40, "g", "seca"], ["cacao", 6, "g", undefined, true]],
    steps: ["Cortá la banana en rodajas y ponela en la licuadora.", "Sumá la leche y la avena. Licuá hasta que quede parejo.", "Si elegís cacao, incorporalo y licuá unos segundos más.", "Repartí en vasos y consumí enseguida. Si esperás para servir, mantenelo tapado en la heladera a menos de 5 °C."],
    substitutions: [["leche", "leche sin lactosa"], ["cacao", "canela"]],
    tags: ["rápida", "sin cocinar", "vegetariana"],
  },
  "yogur-avena-manzana": {
    description: "Yogur natural con manzana fresca y avena para servir frío.",
    servings: 2, prep: 7, cook: 0,
    ingredients: [["yogur", 320, "g"], ["avena", 50, "g", "seca"], ["manzana", 180, "g", "sin semillas"], ["canela", 1, "g", undefined, true]],
    steps: ["Lavá la manzana con agua segura y cortala en cubos chicos.", "Repartí el yogur y la avena en recipientes.", "Agregá la manzana al final para conservar la textura.", "Si usás canela, espolvoreala al servir. Si lo llevás, mantenelo frío en una bolsa térmica con refrigerante."],
    substitutions: [["manzana", "pera"], ["yogur", "yogur sin lactosa"]],
    tags: ["rápida", "sin cocinar", "para llevar"],
  },
  "bowl-arroz-pollo-verduras": {
    description: "Arroz tierno con pollo dorado y verduras salteadas, servido en bowls.",
    servings: 2, prep: 10, cook: 20,
    ingredients: [["arroz", 140, "g", "crudo"], ["pollo", 280, "g", "crudo, sin hueso"], ["zanahoria", 120, "g", "cruda"], ["morrón", 100, "g", undefined, true], ["agua", 300, "ml"], ["aceite", 10, "ml", undefined, true]],
    steps: ["Enjuagá el arroz y cocinalo tapado con el agua a fuego bajo.", "Lavá las verduras con agua segura y cortalas antes de manipular el pollo. Usá otra tabla para el pollo crudo y lavate las manos después.", "Dorá el pollo en cubos y verificá con un termómetro que el centro de los trozos más gruesos llegue a 74 °C. Retiralo a un plato limpio.", "Salteá las verduras 5 minutos y volvé a incorporar el pollo.", "Repartí el arroz y el salteado. Si sobra, pasalo a recipientes poco profundos y refrigerá cuanto antes, antes de 2 horas (1 hora en días de mucho calor)."],
    substitutions: [["morrón", "zapallito"], ["arroz", "cuscús preparado según el envase"]],
    tags: ["reutilizable"],
  },
  "ensalada-garbanzos": {
    description: "Garbanzos, tomate y pepino con limón, fácil de llevar.",
    servings: 2, prep: 12, cook: 0,
    ingredients: [["garbanzo", 320, "g", "cocidos y escurridos"], ["tomate", 200, "g"], ["pepino", 120, "g", undefined, true], ["limón", 20, "ml", "jugo", true], ["aceite", 10, "ml", undefined, true]],
    steps: ["Enjuagá y escurrí los garbanzos cocidos.", "Lavá el tomate y el pepino con agua segura antes de cortarlos en cubos.", "Mezclá en un bol y aderezá con limón y aceite si los usás.", "Repartí en recipientes tapados y refrigerá a menos de 5 °C. Para trasladarlos, usá una bolsa térmica con refrigerante."],
    substitutions: [["garbanzo", "porotos cocidos y escurridos"], ["pepino", "zanahoria rallada"]],
    tags: ["vegetariana", "rápida", "para llevar", "sin cocinar"],
  },
  "wrap-garbanzos": {
    description: "Tortillas rellenas de garbanzos pisados y verduras frescas.",
    servings: 2, prep: 12, cook: 0,
    ingredients: [["tortilla de trigo", 2, "unidades"], ["garbanzo", 240, "g", "cocidos y escurridos"], ["tomate", 120, "g", undefined, true], ["repollo", 60, "g", undefined, true], ["limón", 15, "ml", "jugo", true]],
    steps: ["Pisá los garbanzos con un tenedor y agregá el jugo de limón si lo usás.", "Si usás las verduras, lavalas con agua segura. Cortá el repollo fino y secá el tomate antes de cortarlo.", "Poné el relleno en el centro de cada tortilla.", "Doblá los lados y enrollá desde la base. Si lo llevás, mantenelo refrigerado en una bolsa térmica con refrigerante."],
    substitutions: [["repollo", "lechuga"], ["garbanzo", "porotos blancos cocidos"]],
    tags: ["vegetariana", "rápida", "para llevar", "sin cocinar"],
  },
  "fideos-lentejas": {
    description: "Fideos con salsa espesa de tomate y lentejas, una comida de olla rendidora.",
    servings: 2, prep: 8, cook: 20,
    ingredients: [["fideos", 160, "g", "secos"], ["lenteja", 200, "g", "cocidas y escurridas"], ["tomate triturado", 240, "ml"], ["zanahoria", 80, "g", undefined, true], ["aceite", 10, "ml", undefined, true]],
    steps: ["Poné a hervir agua y cociná los fideos según el envase.", "Rallá la zanahoria y salteala 3 minutos si la usás.", "Sumá el tomate y las lentejas. Cociná a fuego bajo 12 minutos.", "Escurrí y mezclá con la salsa. Si sobra, refrigerá cuanto antes en recipientes poco profundos, antes de 2 horas (1 hora si hace mucho calor)."],
    substitutions: [["lenteja", "garbanzos cocidos picados"], ["zanahoria", "cebolla picada"]],
    tags: ["vegetariana", "económica"],
  },
  "guiso-lentejas": {
    description: "Guiso espeso de lentejas, tomate y verduras de todos los días.",
    servings: 4, prep: 12, cook: 28,
    ingredients: [["lenteja", 460, "g", "cocidas y escurridas"], ["tomate triturado", 350, "ml"], ["papa", 240, "g", "cruda y pelada", true], ["cebolla", 120, "g", undefined, true], ["zanahoria", 150, "g", undefined, true], ["agua", 400, "ml"], ["aceite", 10, "ml", undefined, true], ["pimentón", 2, "g", undefined, true]],
    steps: ["Si usás las verduras, picá la cebolla y cortá la papa y la zanahoria en cubos chicos.", "Si usás cebolla, salteala 4 minutos en una olla.", "Sumá tomate y agua, y las verduras que elegiste. Herví suave hasta que estén tiernas.", "Agregá las lentejas y cociná 8 minutos más. Llevá a hervor y condimentá con pimentón si lo usás. Refrigerá las sobras cuanto antes en recipientes poco profundos, antes de 2 horas (1 hora si hace mucho calor)."],
    substitutions: [["papa", "zapallo en cubos"], ["lenteja", "porotos cocidos y escurridos"]],
    tags: ["vegetariana", "económica", "rendidora"],
  },
  "tortilla-papa-cebolla": {
    description: "Tortilla de papa y cebolla en sartén, dorada por fuera y firme al centro.",
    servings: 2, prep: 10, cook: 22,
    ingredients: [["papa", 360, "g", "cruda y pelada"], ["huevo", 4, "unidades"], ["cebolla", 100, "g"], ["aceite", 15, "ml", undefined, true]],
    steps: ["Cortá la papa en láminas de 4 mm y la cebolla en tiras.", "Cociná ambas tapadas a fuego medio-bajo hasta que la papa esté tierna. Si se pega, usá el aceite indicado.", "Mezclá con los huevos batidos y volcá en una sartén antiadherente.", "Cuando la base esté firme, girá con un plato. Cociná hasta que el centro esté firme y sin huevo líquido. Si tenés termómetro, verificá 71 °C en el centro."],
    substitutions: [["cebolla", "cebolla de verdeo"], ["papa", "batata"]],
    tags: ["económica", "vegetariana", "para llevar"],
  },
  "merluza-papa": {
    description: "Filetes de merluza dorados con papa hervida y limón.",
    servings: 2, prep: 8, cook: 20,
    ingredients: [["merluza", 320, "g", "cruda, sin espinas"], ["papa", 360, "g", "cruda y pelada"], ["limón", 20, "ml", "jugo", true], ["aceite", 10, "ml", undefined, true]],
    steps: ["Cortá la papa en cubos parejos y hervila hasta que esté tierna.", "Si los filetes están congelados, descongelalos en la heladera. Secalos con papel de cocina y calentá una sartén antiadherente.", "Cociná la merluza de ambos lados hasta que el centro de la parte más gruesa alcance 63 °C. Usá utensilios limpios para servir.", "Escurrí la papa y repartila con el pescado y el jugo de limón si lo usás."],
    substitutions: [["papa", "batata"], ["merluza", "otro pescado blanco sin espinas"]],
    tags: ["sin horno"],
  },
  "sopa-zapallo": {
    description: "Sopa cremosa de zapallo y cebolla con caldo de verduras.",
    servings: 3, prep: 10, cook: 25,
    ingredients: [["zapallo", 650, "g", "crudo y pelado"], ["cebolla", 120, "g"], ["caldo", 600, "ml", "de verduras"], ["aceite", 10, "ml", undefined, true], ["queso", 45, "g", undefined, true]],
    steps: ["Cortá el zapallo en cubos de 2 cm y picá la cebolla.", "Cociná la cebolla 4 minutos en la olla y agregá zapallo y caldo.", "Herví suave hasta que el zapallo se desarme al pincharlo.", "Triturá con minipimer fuera del fuego, con el cabezal sumergido para evitar salpicaduras. Volvé a calentar hasta el hervor y serví con queso si lo usás. Refrigerá las sobras cuanto antes en recipientes poco profundos, antes de 2 horas."],
    substitutions: [["zapallo", "batata"], ["caldo", "agua y condimentos suaves"]],
    tags: ["económica", "rendidora"],
  },
};
