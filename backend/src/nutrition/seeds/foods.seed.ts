// backend/src/nutrition/seeds/foods.seed.ts
// Запуск: npx ts-node -r tsconfig-paths/register src/nutrition/seeds/foods.seed.ts
// npm script: pnpm seed:foods

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Food }       from '../food.entity'

// ── База продуктов (КБЖУ на 100г) ────────────────────────────
// Источники:
//   • Скурихин И.М., Тутельян В.А. «Химический состав российских пищевых продуктов» (2002)
//   • Таблицы Института питания РАМН
//   • USDA FoodData Central (для экзотических позиций)

const FOODS: Omit<Food, 'id'>[] = [

  // ══════════════════════════════════════════════════════════════
  // МЯСО — ПТИЦА
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Куриная грудь (филе)',              nameEn: 'Chicken breast fillet',       category: 'Мясо',       kcal: 113, protein: 23.6, fat: 1.9,  carbs: 0.4 },
  { nameRu: 'Куриное бедро без кости',           nameEn: 'Boneless chicken thigh',      category: 'Мясо',       kcal: 185, protein: 18.0, fat: 12.0, carbs: 0.0 },
  { nameRu: 'Куриные ножки',                     nameEn: 'Chicken legs',                category: 'Мясо',       kcal: 158, protein: 17.4, fat: 9.6,  carbs: 0.0 },
  { nameRu: 'Куриные крылья',                    nameEn: 'Chicken wings',               category: 'Мясо',       kcal: 186, protein: 17.0, fat: 13.0, carbs: 0.0 },
  { nameRu: 'Курица целая',                      nameEn: 'Whole chicken',               category: 'Мясо',       kcal: 165, protein: 18.6, fat: 9.7,  carbs: 0.0 },
  { nameRu: 'Куриный фарш',                      nameEn: 'Ground chicken',              category: 'Мясо',       kcal: 143, protein: 17.4, fat: 8.1,  carbs: 0.0 },
  { nameRu: 'Индейка (филе)',                    nameEn: 'Turkey breast fillet',        category: 'Мясо',       kcal: 104, protein: 22.0, fat: 1.5,  carbs: 0.0 },
  { nameRu: 'Индейка (бедро)',                   nameEn: 'Turkey thigh',                category: 'Мясо',       kcal: 144, protein: 20.2, fat: 7.0,  carbs: 0.0 },
  { nameRu: 'Индюшиный фарш',                    nameEn: 'Ground turkey',               category: 'Мясо',       kcal: 170, protein: 20.0, fat: 10.0, carbs: 0.0 },
  { nameRu: 'Утка',                              nameEn: 'Duck',                        category: 'Мясо',       kcal: 308, protein: 15.8, fat: 26.0, carbs: 0.0 },
  { nameRu: 'Гусь',                              nameEn: 'Goose',                       category: 'Мясо',       kcal: 317, protein: 16.1, fat: 27.7, carbs: 0.0 },
  { nameRu: 'Кролик',                            nameEn: 'Rabbit',                      category: 'Мясо',       kcal: 156, protein: 21.1, fat: 8.0,  carbs: 0.0 },
  // ── Говядина
  { nameRu: 'Говядина (вырезка)',                nameEn: 'Beef tenderloin',             category: 'Мясо',       kcal: 158, protein: 22.0, fat: 7.0,  carbs: 0.0 },
  { nameRu: 'Говядина (лопатка)',                nameEn: 'Beef shoulder',               category: 'Мясо',       kcal: 187, protein: 19.0, fat: 12.0, carbs: 0.0 },
  { nameRu: 'Говядина (грудинка)',               nameEn: 'Beef brisket',                category: 'Мясо',       kcal: 224, protein: 17.0, fat: 17.2, carbs: 0.0 },
  { nameRu: 'Говядина (антрекот)',               nameEn: 'Beef ribeye',                 category: 'Мясо',       kcal: 291, protein: 18.9, fat: 23.5, carbs: 0.0 },
  { nameRu: 'Говядина (задняя нога)',            nameEn: 'Beef round',                  category: 'Мясо',       kcal: 169, protein: 20.7, fat: 9.5,  carbs: 0.0 },
  { nameRu: 'Говяжий фарш (20% жира)',           nameEn: 'Ground beef 20% fat',         category: 'Мясо',       kcal: 254, protein: 17.2, fat: 20.0, carbs: 0.0 },
  { nameRu: 'Говяжий фарш (5% жира)',            nameEn: 'Ground beef 5% fat',          category: 'Мясо',       kcal: 152, protein: 20.0, fat: 8.0,  carbs: 0.0 },
  { nameRu: 'Телятина',                          nameEn: 'Veal',                        category: 'Мясо',       kcal: 131, protein: 20.0, fat: 5.5,  carbs: 0.0 },
  // ── Свинина
  { nameRu: 'Свинина (шея)',                     nameEn: 'Pork neck',                   category: 'Мясо',       kcal: 343, protein: 15.0, fat: 31.0, carbs: 0.0 },
  { nameRu: 'Свинина (корейка)',                 nameEn: 'Pork loin',                   category: 'Мясо',       kcal: 221, protein: 19.4, fat: 15.4, carbs: 0.0 },
  { nameRu: 'Свинина (вырезка)',                 nameEn: 'Pork tenderloin',             category: 'Мясо',       kcal: 143, protein: 20.5, fat: 6.6,  carbs: 0.0 },
  { nameRu: 'Свинина (рёбра)',                   nameEn: 'Pork ribs',                   category: 'Мясо',       kcal: 321, protein: 14.4, fat: 28.9, carbs: 0.0 },
  { nameRu: 'Свинина (окорок)',                  nameEn: 'Pork leg',                    category: 'Мясо',       kcal: 261, protein: 15.6, fat: 21.9, carbs: 0.0 },
  { nameRu: 'Свиной фарш',                       nameEn: 'Ground pork',                 category: 'Мясо',       kcal: 263, protein: 16.0, fat: 22.0, carbs: 0.0 },
  // ── Баранина, экзотика
  { nameRu: 'Баранина (корейка)',                nameEn: 'Lamb rack',                   category: 'Мясо',       kcal: 191, protein: 22.0, fat: 11.4, carbs: 0.0 },
  { nameRu: 'Баранина (лопатка)',                nameEn: 'Lamb shoulder',               category: 'Мясо',       kcal: 209, protein: 16.3, fat: 16.0, carbs: 0.0 },
  { nameRu: 'Конина',                            nameEn: 'Horse meat',                  category: 'Мясо',       kcal: 143, protein: 21.0, fat: 7.0,  carbs: 1.0 },
  { nameRu: 'Оленина',                           nameEn: 'Venison',                     category: 'Мясо',       kcal: 158, protein: 22.2, fat: 7.4,  carbs: 0.0 },
  { nameRu: 'Фарш смешанный (свинина+говядина)', nameEn: 'Mixed ground meat',           category: 'Мясо',       kcal: 258, protein: 16.6, fat: 21.0, carbs: 0.0 },
  // ── Субпродукты
  { nameRu: 'Печень куриная',                    nameEn: 'Chicken liver',               category: 'Мясо',       kcal: 140, protein: 20.4, fat: 5.9,  carbs: 0.7 },
  { nameRu: 'Печень говяжья',                    nameEn: 'Beef liver',                  category: 'Мясо',       kcal: 127, protein: 20.0, fat: 3.7,  carbs: 4.2 },
  { nameRu: 'Печень свиная',                     nameEn: 'Pork liver',                  category: 'Мясо',       kcal: 130, protein: 19.0, fat: 4.7,  carbs: 4.4 },
  { nameRu: 'Сердце куриное',                    nameEn: 'Chicken heart',               category: 'Мясо',       kcal: 159, protein: 15.8, fat: 10.3, carbs: 0.1 },
  { nameRu: 'Сердце говяжье',                    nameEn: 'Beef heart',                  category: 'Мясо',       kcal: 112, protein: 17.7, fat: 4.5,  carbs: 0.0 },
  { nameRu: 'Желудки куриные',                   nameEn: 'Chicken gizzards',            category: 'Мясо',       kcal: 130, protein: 21.1, fat: 4.2,  carbs: 1.8 },
  { nameRu: 'Язык говяжий',                      nameEn: 'Beef tongue',                 category: 'Мясо',       kcal: 173, protein: 13.6, fat: 12.1, carbs: 2.2 },
  { nameRu: 'Почки говяжьи',                     nameEn: 'Beef kidneys',                category: 'Мясо',       kcal: 86,  protein: 15.2, fat: 2.8,  carbs: 1.9 },
  // ── Колбасные изделия
  { nameRu: 'Колбаса Докторская',                nameEn: 'Boiled sausage Doctor',       category: 'Мясо',       kcal: 257, protein: 12.8, fat: 22.2, carbs: 1.5 },
  { nameRu: 'Колбаса Молочная',                  nameEn: 'Milk sausage boiled',         category: 'Мясо',       kcal: 252, protein: 11.7, fat: 22.8, carbs: 0.0 },
  { nameRu: 'Колбаса копчёная',                  nameEn: 'Smoked sausage',              category: 'Мясо',       kcal: 402, protein: 16.5, fat: 36.5, carbs: 0.3 },
  { nameRu: 'Колбаса полукопчёная',              nameEn: 'Semi-smoked sausage',         category: 'Мясо',       kcal: 360, protein: 17.0, fat: 32.0, carbs: 0.0 },
  { nameRu: 'Сосиски молочные',                  nameEn: 'Milk sausages',               category: 'Мясо',       kcal: 266, protein: 11.4, fat: 23.9, carbs: 1.6 },
  { nameRu: 'Сардельки',                         nameEn: 'Thick sausages',              category: 'Мясо',       kcal: 332, protein: 11.8, fat: 30.8, carbs: 0.8 },
  { nameRu: 'Ветчина',                           nameEn: 'Ham',                         category: 'Мясо',       kcal: 278, protein: 15.0, fat: 24.0, carbs: 0.1 },
  { nameRu: 'Бекон',                             nameEn: 'Bacon',                       category: 'Мясо',       kcal: 458, protein: 11.6, fat: 45.0, carbs: 0.1 },
  { nameRu: 'Буженина',                          nameEn: 'Braised pork',                category: 'Мясо',       kcal: 255, protein: 15.0, fat: 21.5, carbs: 0.0 },
  { nameRu: 'Карбонад',                          nameEn: 'Carbonade',                   category: 'Мясо',       kcal: 142, protein: 16.0, fat: 8.5,  carbs: 0.0 },
  { nameRu: 'Грудинка копчёная',                 nameEn: 'Smoked pork belly',           category: 'Мясо',       kcal: 514, protein: 10.0, fat: 52.7, carbs: 0.0 },
  { nameRu: 'Паштет печёночный',                 nameEn: 'Liver pate',                  category: 'Мясо',       kcal: 301, protein: 11.6, fat: 28.0, carbs: 2.5 },
  { nameRu: 'Зельц',                             nameEn: 'Head cheese',                 category: 'Мясо',       kcal: 190, protein: 12.7, fat: 14.5, carbs: 1.2 },
  { nameRu: 'Холодец говяжий',                   nameEn: 'Beef aspic',                  category: 'Мясо',       kcal: 80,  protein: 14.5, fat: 2.3,  carbs: 0.3 },

  // ══════════════════════════════════════════════════════════════
  // РЫБА И МОРЕПРОДУКТЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Лосось',                            nameEn: 'Salmon',                      category: 'Рыба',       kcal: 208, protein: 20.0, fat: 13.5, carbs: 0.0 },
  { nameRu: 'Форель радужная',                   nameEn: 'Rainbow trout',               category: 'Рыба',       kcal: 143, protein: 20.5, fat: 6.8,  carbs: 0.0 },
  { nameRu: 'Горбуша',                           nameEn: 'Pink salmon',                 category: 'Рыба',       kcal: 142, protein: 21.0, fat: 6.5,  carbs: 0.0 },
  { nameRu: 'Кета',                              nameEn: 'Chum salmon',                 category: 'Рыба',       kcal: 138, protein: 22.0, fat: 5.6,  carbs: 0.0 },
  { nameRu: 'Нерка',                             nameEn: 'Sockeye salmon',              category: 'Рыба',       kcal: 170, protein: 21.3, fat: 8.3,  carbs: 0.0 },
  { nameRu: 'Кижуч',                             nameEn: 'Coho salmon',                 category: 'Рыба',       kcal: 182, protein: 21.6, fat: 10.4, carbs: 0.0 },
  { nameRu: 'Сёмга слабосолёная',                nameEn: 'Lightly salted salmon',       category: 'Рыба',       kcal: 202, protein: 22.5, fat: 12.5, carbs: 0.0 },
  { nameRu: 'Тунец свежий',                      nameEn: 'Fresh tuna',                  category: 'Рыба',       kcal: 136, protein: 23.3, fat: 4.9,  carbs: 0.0 },
  { nameRu: 'Тунец (консерва в воде)',            nameEn: 'Canned tuna in water',        category: 'Рыба',       kcal: 96,  protein: 22.0, fat: 0.7,  carbs: 0.0 },
  { nameRu: 'Тунец (консерва в масле)',           nameEn: 'Canned tuna in oil',          category: 'Рыба',       kcal: 198, protein: 22.0, fat: 12.0, carbs: 0.0 },
  { nameRu: 'Треска',                            nameEn: 'Cod',                         category: 'Рыба',       kcal: 69,  protein: 16.0, fat: 0.4,  carbs: 0.0 },
  { nameRu: 'Минтай',                            nameEn: 'Pollock',                     category: 'Рыба',       kcal: 72,  protein: 16.1, fat: 0.9,  carbs: 0.0 },
  { nameRu: 'Хек',                               nameEn: 'Hake',                        category: 'Рыба',       kcal: 86,  protein: 16.6, fat: 2.2,  carbs: 0.0 },
  { nameRu: 'Пикша',                             nameEn: 'Haddock',                     category: 'Рыба',       kcal: 74,  protein: 17.2, fat: 0.6,  carbs: 0.0 },
  { nameRu: 'Навага',                            nameEn: 'Saffron cod',                 category: 'Рыба',       kcal: 73,  protein: 16.0, fat: 0.8,  carbs: 0.0 },
  { nameRu: 'Зубатка',                           nameEn: 'Wolffish',                    category: 'Рыба',       kcal: 114, protein: 19.6, fat: 4.1,  carbs: 0.0 },
  { nameRu: 'Палтус',                            nameEn: 'Halibut',                     category: 'Рыба',       kcal: 103, protein: 18.9, fat: 3.0,  carbs: 0.0 },
  { nameRu: 'Камбала',                           nameEn: 'Flounder',                    category: 'Рыба',       kcal: 83,  protein: 15.7, fat: 1.8,  carbs: 0.0 },
  { nameRu: 'Судак',                             nameEn: 'Pike-perch',                  category: 'Рыба',       kcal: 84,  protein: 19.0, fat: 0.8,  carbs: 0.0 },
  { nameRu: 'Щука',                              nameEn: 'Pike',                        category: 'Рыба',       kcal: 84,  protein: 18.4, fat: 1.1,  carbs: 0.0 },
  { nameRu: 'Карп',                              nameEn: 'Carp',                        category: 'Рыба',       kcal: 112, protein: 16.0, fat: 5.3,  carbs: 0.0 },
  { nameRu: 'Окунь речной',                      nameEn: 'River perch',                 category: 'Рыба',       kcal: 82,  protein: 18.5, fat: 0.9,  carbs: 0.0 },
  { nameRu: 'Сом',                               nameEn: 'Catfish',                     category: 'Рыба',       kcal: 115, protein: 17.2, fat: 5.1,  carbs: 0.0 },
  { nameRu: 'Сазан',                             nameEn: 'Wild carp',                   category: 'Рыба',       kcal: 97,  protein: 18.4, fat: 2.7,  carbs: 0.0 },
  { nameRu: 'Лещ',                               nameEn: 'Bream',                       category: 'Рыба',       kcal: 105, protein: 17.1, fat: 4.4,  carbs: 0.0 },
  { nameRu: 'Сельдь',                            nameEn: 'Herring',                     category: 'Рыба',       kcal: 161, protein: 17.7, fat: 9.7,  carbs: 0.0 },
  { nameRu: 'Сельдь солёная',                    nameEn: 'Salted herring',              category: 'Рыба',       kcal: 217, protein: 17.5, fat: 16.3, carbs: 0.0 },
  { nameRu: 'Скумбрия',                          nameEn: 'Mackerel',                    category: 'Рыба',       kcal: 191, protein: 18.0, fat: 13.2, carbs: 0.0 },
  { nameRu: 'Скумбрия копчёная',                 nameEn: 'Smoked mackerel',             category: 'Рыба',       kcal: 221, protein: 20.7, fat: 15.4, carbs: 0.0 },
  { nameRu: 'Тилапия',                           nameEn: 'Tilapia',                     category: 'Рыба',       kcal: 96,  protein: 20.1, fat: 1.7,  carbs: 0.0 },
  { nameRu: 'Дорадо (морской карась)',            nameEn: 'Sea bream',                   category: 'Рыба',       kcal: 96,  protein: 18.4, fat: 2.5,  carbs: 0.0 },
  { nameRu: 'Сибас',                             nameEn: 'European sea bass',           category: 'Рыба',       kcal: 97,  protein: 18.7, fat: 2.3,  carbs: 0.0 },
  { nameRu: 'Пангасиус',                         nameEn: 'Pangasius',                   category: 'Рыба',       kcal: 89,  protein: 15.0, fat: 3.0,  carbs: 0.0 },
  { nameRu: 'Мойва',                             nameEn: 'Capelin',                     category: 'Рыба',       kcal: 157, protein: 13.4, fat: 11.5, carbs: 0.0 },
  { nameRu: 'Сардина (консерва)',                nameEn: 'Canned sardine',              category: 'Рыба',       kcal: 208, protein: 17.9, fat: 11.5, carbs: 1.4 },
  { nameRu: 'Килька в томате (консерва)',         nameEn: 'Sprats in tomato sauce',      category: 'Рыба',       kcal: 98,  protein: 12.3, fat: 3.6,  carbs: 4.8 },
  { nameRu: 'Шпроты в масле (консерва)',          nameEn: 'Sprats in oil',               category: 'Рыба',       kcal: 363, protein: 17.4, fat: 32.4, carbs: 0.4 },
  { nameRu: 'Лосось консервированный',            nameEn: 'Canned salmon',               category: 'Рыба',       kcal: 142, protein: 21.5, fat: 6.0,  carbs: 0.0 },
  { nameRu: 'Икра красная (лосось)',              nameEn: 'Red salmon caviar',           category: 'Рыба',       kcal: 251, protein: 31.5, fat: 13.2, carbs: 0.0 },
  { nameRu: 'Икра чёрная (осётр)',               nameEn: 'Black sturgeon caviar',       category: 'Рыба',       kcal: 264, protein: 26.8, fat: 17.9, carbs: 0.0 },
  { nameRu: 'Икра минтая (солёная)',             nameEn: 'Salted pollock roe',          category: 'Рыба',       kcal: 131, protein: 28.4, fat: 2.3,  carbs: 0.0 },
  // ── Морепродукты
  { nameRu: 'Креветки варёные',                  nameEn: 'Boiled shrimp',               category: 'Рыба',       kcal: 95,  protein: 20.0, fat: 1.0,  carbs: 0.0 },
  { nameRu: 'Креветки тигровые',                 nameEn: 'Tiger shrimp',                category: 'Рыба',       kcal: 87,  protein: 19.5, fat: 0.6,  carbs: 0.0 },
  { nameRu: 'Кальмар',                           nameEn: 'Squid',                       category: 'Рыба',       kcal: 92,  protein: 18.0, fat: 1.4,  carbs: 1.5 },
  { nameRu: 'Осьминог',                          nameEn: 'Octopus',                     category: 'Рыба',       kcal: 82,  protein: 14.9, fat: 1.0,  carbs: 2.2 },
  { nameRu: 'Мидии',                             nameEn: 'Mussels',                     category: 'Рыба',       kcal: 77,  protein: 11.5, fat: 2.0,  carbs: 3.3 },
  { nameRu: 'Устрицы',                           nameEn: 'Oysters',                     category: 'Рыба',       kcal: 72,  protein: 9.0,  fat: 2.5,  carbs: 4.3 },
  { nameRu: 'Гребешок морской',                  nameEn: 'Scallop',                     category: 'Рыба',       kcal: 88,  protein: 17.1, fat: 0.8,  carbs: 2.4 },
  { nameRu: 'Краб (консерва)',                   nameEn: 'Canned crab',                 category: 'Рыба',       kcal: 85,  protein: 18.7, fat: 1.0,  carbs: 0.0 },
  { nameRu: 'Крабовые палочки',                  nameEn: 'Crab sticks',                 category: 'Рыба',       kcal: 94,  protein: 6.0,  fat: 0.9,  carbs: 14.5 },
  { nameRu: 'Рапаны',                            nameEn: 'Rapa whelks',                 category: 'Рыба',       kcal: 82,  protein: 15.5, fat: 0.8,  carbs: 2.6 },

  // ══════════════════════════════════════════════════════════════
  // МОЛОЧНЫЕ ПРОДУКТЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Молоко 0.5%',                       nameEn: 'Milk 0.5%',                   category: 'Молочное',   kcal: 31,  protein: 3.0,  fat: 0.5,  carbs: 4.7 },
  { nameRu: 'Молоко 1%',                         nameEn: 'Milk 1%',                     category: 'Молочное',   kcal: 40,  protein: 2.8,  fat: 1.0,  carbs: 4.7 },
  { nameRu: 'Молоко 2.5%',                       nameEn: 'Milk 2.5%',                   category: 'Молочное',   kcal: 52,  protein: 2.8,  fat: 2.5,  carbs: 4.7 },
  { nameRu: 'Молоко 3.2%',                       nameEn: 'Milk 3.2%',                   category: 'Молочное',   kcal: 58,  protein: 2.9,  fat: 3.2,  carbs: 4.7 },
  { nameRu: 'Молоко топлёное 4%',                nameEn: 'Baked milk 4%',               category: 'Молочное',   kcal: 67,  protein: 3.0,  fat: 4.0,  carbs: 4.7 },
  { nameRu: 'Молоко сгущённое с сахаром',         nameEn: 'Sweetened condensed milk',    category: 'Молочное',   kcal: 328, protein: 7.2,  fat: 8.5,  carbs: 55.5 },
  { nameRu: 'Молоко сухое обезжиренное',          nameEn: 'Skim powdered milk',          category: 'Молочное',   kcal: 362, protein: 36.0, fat: 1.0,  carbs: 52.0 },
  { nameRu: 'Молоко сухое цельное',               nameEn: 'Whole powdered milk',         category: 'Молочное',   kcal: 549, protein: 26.0, fat: 25.0, carbs: 37.5 },
  { nameRu: 'Кефир 0%',                          nameEn: 'Kefir 0%',                    category: 'Молочное',   kcal: 31,  protein: 3.0,  fat: 0.1,  carbs: 4.1 },
  { nameRu: 'Кефир 1%',                          nameEn: 'Kefir 1%',                    category: 'Молочное',   kcal: 40,  protein: 2.8,  fat: 1.0,  carbs: 4.0 },
  { nameRu: 'Кефир 2.5%',                        nameEn: 'Kefir 2.5%',                  category: 'Молочное',   kcal: 53,  protein: 2.9,  fat: 2.5,  carbs: 4.0 },
  { nameRu: 'Ряженка 2.5%',                      nameEn: 'Ryazhenka 2.5%',              category: 'Молочное',   kcal: 54,  protein: 2.8,  fat: 2.5,  carbs: 4.2 },
  { nameRu: 'Ряженка 4%',                        nameEn: 'Ryazhenka 4%',                category: 'Молочное',   kcal: 67,  protein: 2.8,  fat: 4.0,  carbs: 4.1 },
  { nameRu: 'Простокваша',                        nameEn: 'Prostokvashe fermented milk', category: 'Молочное',   kcal: 59,  protein: 2.9,  fat: 3.2,  carbs: 4.1 },
  { nameRu: 'Айран 1.5%',                        nameEn: 'Ayran 1.5%',                  category: 'Молочное',   kcal: 27,  protein: 1.1,  fat: 1.5,  carbs: 2.0 },
  { nameRu: 'Тан',                               nameEn: 'Tan (fermented milk drink)',  category: 'Молочное',   kcal: 23,  protein: 0.9,  fat: 1.5,  carbs: 1.1 },
  { nameRu: 'Йогурт натуральный 1.5%',           nameEn: 'Plain yogurt 1.5%',           category: 'Молочное',   kcal: 47,  protein: 4.3,  fat: 1.5,  carbs: 3.5 },
  { nameRu: 'Йогурт натуральный 3.2%',           nameEn: 'Plain yogurt 3.2%',           category: 'Молочное',   kcal: 66,  protein: 5.0,  fat: 3.2,  carbs: 3.5 },
  { nameRu: 'Йогурт греческий 0%',               nameEn: 'Greek yogurt 0%',             category: 'Молочное',   kcal: 59,  protein: 10.0, fat: 0.4,  carbs: 3.6 },
  { nameRu: 'Йогурт греческий 2%',               nameEn: 'Greek yogurt 2%',             category: 'Молочное',   kcal: 73,  protein: 10.0, fat: 2.0,  carbs: 3.6 },
  { nameRu: 'Йогурт греческий 5%',               nameEn: 'Greek yogurt 5%',             category: 'Молочное',   kcal: 100, protein: 9.0,  fat: 5.0,  carbs: 3.6 },
  { nameRu: 'Творог 0%',                         nameEn: 'Cottage cheese 0%',           category: 'Молочное',   kcal: 71,  protein: 16.5, fat: 0.0,  carbs: 1.3 },
  { nameRu: 'Творог 2%',                         nameEn: 'Cottage cheese 2%',           category: 'Молочное',   kcal: 103, protein: 16.5, fat: 2.0,  carbs: 1.5 },
  { nameRu: 'Творог 5%',                         nameEn: 'Cottage cheese 5%',           category: 'Молочное',   kcal: 121, protein: 17.2, fat: 5.0,  carbs: 1.8 },
  { nameRu: 'Творог 9%',                         nameEn: 'Cottage cheese 9%',           category: 'Молочное',   kcal: 159, protein: 16.7, fat: 9.0,  carbs: 2.0 },
  { nameRu: 'Творог 18%',                        nameEn: 'Cottage cheese 18%',          category: 'Молочное',   kcal: 232, protein: 15.0, fat: 18.0, carbs: 2.8 },
  { nameRu: 'Творожная масса сладкая',            nameEn: 'Sweetened curd mass',         category: 'Молочное',   kcal: 257, protein: 10.5, fat: 11.2, carbs: 29.6 },
  { nameRu: 'Сметана 10%',                       nameEn: 'Sour cream 10%',              category: 'Молочное',   kcal: 115, protein: 3.0,  fat: 10.0, carbs: 4.0 },
  { nameRu: 'Сметана 15%',                       nameEn: 'Sour cream 15%',              category: 'Молочное',   kcal: 160, protein: 2.6,  fat: 15.0, carbs: 3.7 },
  { nameRu: 'Сметана 20%',                       nameEn: 'Sour cream 20%',              category: 'Молочное',   kcal: 204, protein: 2.5,  fat: 20.0, carbs: 3.7 },
  { nameRu: 'Сметана 30%',                       nameEn: 'Sour cream 30%',              category: 'Молочное',   kcal: 293, protein: 2.4,  fat: 30.0, carbs: 3.1 },
  { nameRu: 'Сливки 10%',                        nameEn: 'Cream 10%',                   category: 'Молочное',   kcal: 118, protein: 2.8,  fat: 10.0, carbs: 4.0 },
  { nameRu: 'Сливки 20%',                        nameEn: 'Cream 20%',                   category: 'Молочное',   kcal: 205, protein: 2.5,  fat: 20.0, carbs: 3.7 },
  { nameRu: 'Сливки 33%',                        nameEn: 'Cream 33%',                   category: 'Молочное',   kcal: 322, protein: 2.2,  fat: 33.0, carbs: 4.0 },
  { nameRu: 'Масло сливочное 72.5%',             nameEn: 'Butter 72.5%',                category: 'Молочное',   kcal: 661, protein: 0.8,  fat: 72.5, carbs: 1.3 },
  { nameRu: 'Масло сливочное 82.5%',             nameEn: 'Butter 82.5%',                category: 'Молочное',   kcal: 748, protein: 0.8,  fat: 82.5, carbs: 0.7 },
  // ── Сыры
  { nameRu: 'Сыр Российский',                    nameEn: 'Russian cheese',              category: 'Молочное',   kcal: 363, protein: 23.0, fat: 29.0, carbs: 0.3 },
  { nameRu: 'Сыр Голландский',                   nameEn: 'Dutch cheese',                category: 'Молочное',   kcal: 352, protein: 26.0, fat: 26.8, carbs: 0.0 },
  { nameRu: 'Сыр Костромской',                   nameEn: 'Kostroma cheese',             category: 'Молочное',   kcal: 345, protein: 26.8, fat: 26.3, carbs: 0.0 },
  { nameRu: 'Сыр Пошехонский',                   nameEn: 'Poshekhonsky cheese',         category: 'Молочное',   kcal: 334, protein: 26.0, fat: 26.5, carbs: 0.0 },
  { nameRu: 'Сыр Гауда',                         nameEn: 'Gouda',                       category: 'Молочное',   kcal: 356, protein: 25.0, fat: 27.4, carbs: 2.2 },
  { nameRu: 'Сыр Эдам',                          nameEn: 'Edam',                        category: 'Молочное',   kcal: 337, protein: 25.0, fat: 26.0, carbs: 0.4 },
  { nameRu: 'Сыр Пармезан',                      nameEn: 'Parmesan',                    category: 'Молочное',   kcal: 392, protein: 35.8, fat: 26.0, carbs: 3.2 },
  { nameRu: 'Сыр Моцарелла',                     nameEn: 'Mozzarella',                  category: 'Молочное',   kcal: 280, protein: 22.0, fat: 20.0, carbs: 2.2 },
  { nameRu: 'Сыр Фета',                          nameEn: 'Feta',                        category: 'Молочное',   kcal: 264, protein: 14.2, fat: 21.3, carbs: 4.1 },
  { nameRu: 'Сыр Адыгейский',                    nameEn: 'Adyghe cheese',               category: 'Молочное',   kcal: 264, protein: 19.8, fat: 20.1, carbs: 0.0 },
  { nameRu: 'Сыр Сулугуни',                      nameEn: 'Suluguni',                    category: 'Молочное',   kcal: 286, protein: 20.5, fat: 22.5, carbs: 0.4 },
  { nameRu: 'Сыр Камамбер',                      nameEn: 'Camembert',                   category: 'Молочное',   kcal: 300, protein: 19.8, fat: 24.3, carbs: 0.5 },
  { nameRu: 'Сыр Бри',                           nameEn: 'Brie',                        category: 'Молочное',   kcal: 334, protein: 20.8, fat: 27.7, carbs: 0.5 },
  { nameRu: 'Сыр Маасдам',                       nameEn: 'Maasdam',                     category: 'Молочное',   kcal: 350, protein: 23.5, fat: 27.6, carbs: 0.0 },
  { nameRu: 'Сыр плавленый Дружба',              nameEn: 'Processed cheese',            category: 'Молочное',   kcal: 271, protein: 16.0, fat: 20.0, carbs: 7.0 },
  { nameRu: 'Сырок творожный 23%',               nameEn: 'Glazed curd bar',             category: 'Молочное',   kcal: 340, protein: 7.1,  fat: 23.0, carbs: 27.0 },
  { nameRu: 'Мороженое пломбир',                 nameEn: 'Plombir ice cream',           category: 'Молочное',   kcal: 226, protein: 3.7,  fat: 12.0, carbs: 26.3 },
  { nameRu: 'Мороженое молочное',                nameEn: 'Milk ice cream',              category: 'Молочное',   kcal: 126, protein: 3.2,  fat: 3.5,  carbs: 20.4 },
  { nameRu: 'Мороженое фруктовое лёд',           nameEn: 'Fruit ice popsicle',          category: 'Молочное',   kcal: 70,  protein: 0.1,  fat: 0.0,  carbs: 17.5 },

  // ══════════════════════════════════════════════════════════════
  // ЯЙЦА
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Яйцо куриное (1 шт ~60г)',          nameEn: 'Chicken egg whole',           category: 'Яйца',       kcal: 157, protein: 12.7, fat: 11.5, carbs: 0.7 },
  { nameRu: 'Белок яичный',                      nameEn: 'Egg white',                   category: 'Яйца',       kcal: 44,  protein: 11.1, fat: 0.1,  carbs: 0.7 },
  { nameRu: 'Желток яичный',                     nameEn: 'Egg yolk',                    category: 'Яйца',       kcal: 352, protein: 16.2, fat: 31.9, carbs: 1.0 },
  { nameRu: 'Яйцо перепелиное (1 шт ~12г)',      nameEn: 'Quail egg',                   category: 'Яйца',       kcal: 168, protein: 13.1, fat: 11.9, carbs: 0.6 },
  { nameRu: 'Яичный порошок',                    nameEn: 'Dried egg powder',            category: 'Яйца',       kcal: 542, protein: 45.0, fat: 37.3, carbs: 4.5 },
  { nameRu: 'Яйцо варёное вкрутую',              nameEn: 'Hard boiled egg',             category: 'Яйца',       kcal: 155, protein: 12.6, fat: 10.6, carbs: 0.6 },

  // ══════════════════════════════════════════════════════════════
  // КРУПЫ, БОБОВЫЕ, МАКАРОНЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Гречка (сухая)',                    nameEn: 'Buckwheat dry',               category: 'Крупы',      kcal: 343, protein: 12.6, fat: 3.3,  carbs: 62.1 },
  { nameRu: 'Гречка (варёная)',                  nameEn: 'Buckwheat cooked',            category: 'Крупы',      kcal: 110, protein: 4.2,  fat: 1.1,  carbs: 21.0 },
  { nameRu: 'Рис белый (сухой)',                 nameEn: 'White rice dry',              category: 'Крупы',      kcal: 344, protein: 6.7,  fat: 0.7,  carbs: 78.9 },
  { nameRu: 'Рис белый (варёный)',               nameEn: 'White rice cooked',           category: 'Крупы',      kcal: 116, protein: 2.2,  fat: 0.5,  carbs: 25.0 },
  { nameRu: 'Рис бурый (варёный)',               nameEn: 'Brown rice cooked',           category: 'Крупы',      kcal: 111, protein: 2.6,  fat: 0.9,  carbs: 23.0 },
  { nameRu: 'Рис пропаренный (варёный)',         nameEn: 'Parboiled rice cooked',       category: 'Крупы',      kcal: 123, protein: 2.4,  fat: 0.4,  carbs: 26.4 },
  { nameRu: 'Рис для суши (готовый)',            nameEn: 'Sushi rice cooked',           category: 'Крупы',      kcal: 150, protein: 2.5,  fat: 0.3,  carbs: 33.5 },
  { nameRu: 'Рис дикий (варёный)',               nameEn: 'Wild rice cooked',            category: 'Крупы',      kcal: 101, protein: 4.0,  fat: 0.3,  carbs: 21.3 },
  { nameRu: 'Овсянка (сухая)',                   nameEn: 'Oats dry',                    category: 'Крупы',      kcal: 366, protein: 12.3, fat: 6.1,  carbs: 59.5 },
  { nameRu: 'Овсянка (варёная на воде)',         nameEn: 'Oatmeal cooked water',        category: 'Крупы',      kcal: 84,  protein: 3.0,  fat: 1.7,  carbs: 15.0 },
  { nameRu: 'Овсянка (варёная на молоке)',       nameEn: 'Oatmeal cooked milk',         category: 'Крупы',      kcal: 102, protein: 3.7,  fat: 3.3,  carbs: 14.0 },
  { nameRu: 'Хлопья кукурузные (несладкие)',     nameEn: 'Corn flakes unsweetened',     category: 'Крупы',      kcal: 357, protein: 8.0,  fat: 1.0,  carbs: 79.0 },
  { nameRu: 'Мюсли без сахара',                  nameEn: 'Muesli unsweetened',          category: 'Крупы',      kcal: 338, protein: 9.5,  fat: 5.8,  carbs: 62.0 },
  { nameRu: 'Перловая крупа (варёная)',          nameEn: 'Pearl barley cooked',         category: 'Крупы',      kcal: 109, protein: 3.1,  fat: 0.4,  carbs: 22.2 },
  { nameRu: 'Пшённая каша (на воде)',            nameEn: 'Millet porridge water',       category: 'Крупы',      kcal: 90,  protein: 3.0,  fat: 0.7,  carbs: 17.0 },
  { nameRu: 'Манная каша (на воде)',             nameEn: 'Semolina porridge water',     category: 'Крупы',      kcal: 80,  protein: 2.5,  fat: 0.3,  carbs: 16.9 },
  { nameRu: 'Манная каша (на молоке)',           nameEn: 'Semolina porridge milk',      category: 'Крупы',      kcal: 98,  protein: 3.6,  fat: 3.2,  carbs: 15.3 },
  { nameRu: 'Кукурузная каша (на воде)',         nameEn: 'Corn porridge cooked',        category: 'Крупы',      kcal: 86,  protein: 2.5,  fat: 0.3,  carbs: 17.6 },
  { nameRu: 'Булгур (варёный)',                  nameEn: 'Bulgur cooked',               category: 'Крупы',      kcal: 83,  protein: 3.1,  fat: 0.2,  carbs: 18.6 },
  { nameRu: 'Киноа (варёная)',                   nameEn: 'Quinoa cooked',               category: 'Крупы',      kcal: 120, protein: 4.4,  fat: 1.9,  carbs: 21.3 },
  { nameRu: 'Кускус (варёный)',                  nameEn: 'Couscous cooked',             category: 'Крупы',      kcal: 112, protein: 3.8,  fat: 0.2,  carbs: 23.2 },
  { nameRu: 'Амарант (варёный)',                 nameEn: 'Amaranth cooked',             category: 'Крупы',      kcal: 102, protein: 3.8,  fat: 1.6,  carbs: 18.7 },
  { nameRu: 'Полба (варёная)',                   nameEn: 'Spelt cooked',                category: 'Крупы',      kcal: 127, protein: 5.5,  fat: 0.9,  carbs: 26.0 },
  // ── Бобовые
  { nameRu: 'Чечевица красная (варёная)',        nameEn: 'Red lentils cooked',          category: 'Крупы',      kcal: 116, protein: 9.0,  fat: 0.4,  carbs: 20.1 },
  { nameRu: 'Чечевица зелёная (варёная)',        nameEn: 'Green lentils cooked',        category: 'Крупы',      kcal: 111, protein: 7.8,  fat: 0.4,  carbs: 20.0 },
  { nameRu: 'Горох (варёный)',                   nameEn: 'Peas cooked',                 category: 'Крупы',      kcal: 116, protein: 8.0,  fat: 0.4,  carbs: 20.6 },
  { nameRu: 'Горох (сухой)',                     nameEn: 'Peas dry',                    category: 'Крупы',      kcal: 298, protein: 20.5, fat: 2.0,  carbs: 49.5 },
  { nameRu: 'Фасоль белая (варёная)',            nameEn: 'White beans cooked',          category: 'Крупы',      kcal: 127, protein: 8.7,  fat: 0.5,  carbs: 21.5 },
  { nameRu: 'Фасоль красная (варёная)',          nameEn: 'Red kidney beans cooked',     category: 'Крупы',      kcal: 123, protein: 8.4,  fat: 0.5,  carbs: 22.0 },
  { nameRu: 'Фасоль консервированная',           nameEn: 'Canned beans',                category: 'Крупы',      kcal: 99,  protein: 6.9,  fat: 0.5,  carbs: 17.5 },
  { nameRu: 'Нут (варёный)',                     nameEn: 'Chickpeas cooked',            category: 'Крупы',      kcal: 164, protein: 8.9,  fat: 2.6,  carbs: 27.4 },
  { nameRu: 'Соя (варёная)',                     nameEn: 'Soybeans cooked',             category: 'Крупы',      kcal: 141, protein: 16.6, fat: 7.3,  carbs: 11.1 },
  { nameRu: 'Эдамамэ',                           nameEn: 'Edamame',                     category: 'Крупы',      kcal: 121, protein: 11.9, fat: 5.2,  carbs: 8.9 },
  { nameRu: 'Маш (варёный)',                     nameEn: 'Mung beans cooked',           category: 'Крупы',      kcal: 105, protein: 7.0,  fat: 0.4,  carbs: 19.1 },
  // ── Макаронные изделия
  { nameRu: 'Макароны (сухие)',                  nameEn: 'Pasta dry',                   category: 'Крупы',      kcal: 338, protein: 12.0, fat: 1.5,  carbs: 67.0 },
  { nameRu: 'Макароны (варёные)',                nameEn: 'Pasta cooked',                category: 'Крупы',      kcal: 158, protein: 5.5,  fat: 0.9,  carbs: 30.9 },
  { nameRu: 'Спагетти (варёные)',                nameEn: 'Spaghetti cooked',            category: 'Крупы',      kcal: 157, protein: 5.8,  fat: 0.9,  carbs: 30.4 },
  { nameRu: 'Макароны цельнозерновые (варёные)', nameEn: 'Whole wheat pasta cooked',    category: 'Крупы',      kcal: 124, protein: 5.3,  fat: 0.5,  carbs: 26.5 },
  { nameRu: 'Лапша рисовая (варёная)',           nameEn: 'Rice noodles cooked',         category: 'Крупы',      kcal: 108, protein: 1.8,  fat: 0.2,  carbs: 25.2 },
  { nameRu: 'Вермишель (варёная)',               nameEn: 'Vermicelli cooked',           category: 'Крупы',      kcal: 152, protein: 5.5,  fat: 0.8,  carbs: 30.5 },
  { nameRu: 'Лапша яичная (варёная)',            nameEn: 'Egg noodles cooked',          category: 'Крупы',      kcal: 138, protein: 4.5,  fat: 2.1,  carbs: 25.2 },
  { nameRu: 'Фунчоза (варёная)',                 nameEn: 'Glass noodles cooked',        category: 'Крупы',      kcal: 84,  protein: 0.2,  fat: 0.0,  carbs: 21.3 },

  // ══════════════════════════════════════════════════════════════
  // ХЛЕБ И ВЫПЕЧКА
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Хлеб белый пшеничный',             nameEn: 'White wheat bread',           category: 'Хлеб',       kcal: 265, protein: 7.7,  fat: 3.2,  carbs: 49.0 },
  { nameRu: 'Хлеб ржаной',                      nameEn: 'Rye bread',                   category: 'Хлеб',       kcal: 214, protein: 6.6,  fat: 1.2,  carbs: 44.0 },
  { nameRu: 'Хлеб Бородинский',                 nameEn: 'Borodinsky bread',            category: 'Хлеб',       kcal: 207, protein: 6.8,  fat: 1.3,  carbs: 40.7 },
  { nameRu: 'Хлеб цельнозерновой',              nameEn: 'Whole grain bread',           category: 'Хлеб',       kcal: 247, protein: 9.5,  fat: 3.1,  carbs: 45.0 },
  { nameRu: 'Батон нарезной',                   nameEn: 'Sliced loaf',                 category: 'Хлеб',       kcal: 264, protein: 7.4,  fat: 3.3,  carbs: 48.4 },
  { nameRu: 'Хлеб с отрубями',                  nameEn: 'Bran bread',                  category: 'Хлеб',       kcal: 227, protein: 8.6,  fat: 2.3,  carbs: 43.0 },
  { nameRu: 'Хлеб Дарницкий',                   nameEn: 'Darnitsky rye bread',         category: 'Хлеб',       kcal: 206, protein: 6.4,  fat: 1.5,  carbs: 41.2 },
  { nameRu: 'Хлебцы рисовые',                   nameEn: 'Rice cakes',                  category: 'Хлеб',       kcal: 381, protein: 7.9,  fat: 3.5,  carbs: 81.5 },
  { nameRu: 'Хлебцы ржаные',                    nameEn: 'Rye crispbread',              category: 'Хлеб',       kcal: 336, protein: 9.5,  fat: 1.8,  carbs: 70.0 },
  { nameRu: 'Хлебцы пшеничные',                 nameEn: 'Wheat crispbread',            category: 'Хлеб',       kcal: 355, protein: 9.0,  fat: 2.3,  carbs: 74.0 },
  { nameRu: 'Лаваш армянский',                  nameEn: 'Armenian lavash',             category: 'Хлеб',       kcal: 277, protein: 9.1,  fat: 1.1,  carbs: 57.0 },
  { nameRu: 'Питта',                            nameEn: 'Pita bread',                  category: 'Хлеб',       kcal: 275, protein: 9.1,  fat: 1.2,  carbs: 55.7 },
  { nameRu: 'Тортилья пшеничная',               nameEn: 'Wheat tortilla',              category: 'Хлеб',       kcal: 304, protein: 8.3,  fat: 7.3,  carbs: 50.5 },
  { nameRu: 'Булочка для бургера',               nameEn: 'Burger bun',                  category: 'Хлеб',       kcal: 270, protein: 8.0,  fat: 4.5,  carbs: 49.0 },
  { nameRu: 'Круассан',                         nameEn: 'Croissant',                   category: 'Хлеб',       kcal: 406, protein: 8.2,  fat: 21.0, carbs: 46.5 },
  { nameRu: 'Печенье овсяное',                   nameEn: 'Oatmeal cookies',             category: 'Хлеб',       kcal: 437, protein: 6.6,  fat: 15.4, carbs: 69.1 },
  { nameRu: 'Печенье сахарное',                  nameEn: 'Sugar cookies',               category: 'Хлеб',       kcal: 418, protein: 7.5,  fat: 12.7, carbs: 69.3 },
  { nameRu: 'Пряник',                           nameEn: 'Gingerbread',                 category: 'Хлеб',       kcal: 336, protein: 5.8,  fat: 2.8,  carbs: 73.1 },
  { nameRu: 'Вафли',                            nameEn: 'Wafers',                      category: 'Хлеб',       kcal: 539, protein: 7.6,  fat: 30.2, carbs: 61.4 },
  { nameRu: 'Сушки',                            nameEn: 'Sushki ring crackers',        category: 'Хлеб',       kcal: 330, protein: 10.5, fat: 1.3,  carbs: 68.6 },
  { nameRu: 'Баранки',                          nameEn: 'Baranki ring rolls',          category: 'Хлеб',       kcal: 312, protein: 10.4, fat: 1.2,  carbs: 65.1 },
  { nameRu: 'Сухари ржаные',                    nameEn: 'Rye crackers',                category: 'Хлеб',       kcal: 327, protein: 9.5,  fat: 3.1,  carbs: 66.4 },
  { nameRu: 'Чиабатта',                         nameEn: 'Ciabatta',                    category: 'Хлеб',       kcal: 271, protein: 8.6,  fat: 4.2,  carbs: 50.0 },

  // ══════════════════════════════════════════════════════════════
  // ОВОЩИ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Картофель сырой',                   nameEn: 'Raw potato',                  category: 'Овощи',      kcal: 77,  protein: 2.0,  fat: 0.1,  carbs: 16.3 },
  { nameRu: 'Картофель варёный',                 nameEn: 'Boiled potato',               category: 'Овощи',      kcal: 82,  protein: 2.0,  fat: 0.1,  carbs: 17.3 },
  { nameRu: 'Картофель запечённый',              nameEn: 'Baked potato',                category: 'Овощи',      kcal: 93,  protein: 2.5,  fat: 0.1,  carbs: 21.0 },
  { nameRu: 'Картофельное пюре',                 nameEn: 'Mashed potato',               category: 'Овощи',      kcal: 106, protein: 2.5,  fat: 3.7,  carbs: 14.4 },
  { nameRu: 'Морковь сырая',                     nameEn: 'Raw carrot',                  category: 'Овощи',      kcal: 35,  protein: 1.3,  fat: 0.1,  carbs: 6.9 },
  { nameRu: 'Морковь варёная',                   nameEn: 'Boiled carrot',               category: 'Овощи',      kcal: 35,  protein: 0.8,  fat: 0.1,  carbs: 8.0 },
  { nameRu: 'Свёкла варёная',                    nameEn: 'Boiled beet',                 category: 'Овощи',      kcal: 43,  protein: 1.5,  fat: 0.1,  carbs: 8.8 },
  { nameRu: 'Свёкла сырая',                      nameEn: 'Raw beet',                    category: 'Овощи',      kcal: 43,  protein: 1.5,  fat: 0.1,  carbs: 9.6 },
  { nameRu: 'Капуста белокочанная',              nameEn: 'White cabbage',               category: 'Овощи',      kcal: 27,  protein: 1.8,  fat: 0.1,  carbs: 4.7 },
  { nameRu: 'Капуста квашеная',                  nameEn: 'Sauerkraut',                  category: 'Овощи',      kcal: 19,  protein: 1.6,  fat: 0.0,  carbs: 3.0 },
  { nameRu: 'Капуста пекинская',                 nameEn: 'Chinese cabbage',             category: 'Овощи',      kcal: 16,  protein: 1.2,  fat: 0.2,  carbs: 2.0 },
  { nameRu: 'Капуста брокколи',                  nameEn: 'Broccoli',                    category: 'Овощи',      kcal: 34,  protein: 2.8,  fat: 0.4,  carbs: 6.6 },
  { nameRu: 'Капуста цветная',                   nameEn: 'Cauliflower',                 category: 'Овощи',      kcal: 30,  protein: 2.5,  fat: 0.3,  carbs: 5.4 },
  { nameRu: 'Капуста краснокочанная',            nameEn: 'Red cabbage',                 category: 'Овощи',      kcal: 24,  protein: 1.3,  fat: 0.1,  carbs: 4.7 },
  { nameRu: 'Брюссельская капуста',              nameEn: 'Brussels sprouts',            category: 'Овощи',      kcal: 43,  protein: 3.4,  fat: 0.3,  carbs: 8.9 },
  { nameRu: 'Кольраби',                          nameEn: 'Kohlrabi',                    category: 'Овощи',      kcal: 27,  protein: 1.7,  fat: 0.1,  carbs: 5.9 },
  { nameRu: 'Помидор',                           nameEn: 'Tomato',                      category: 'Овощи',      kcal: 20,  protein: 1.1,  fat: 0.2,  carbs: 3.7 },
  { nameRu: 'Помидоры черри',                    nameEn: 'Cherry tomatoes',             category: 'Овощи',      kcal: 18,  protein: 0.9,  fat: 0.2,  carbs: 3.5 },
  { nameRu: 'Томатная паста',                    nameEn: 'Tomato paste',                category: 'Овощи',      kcal: 82,  protein: 4.8,  fat: 0.5,  carbs: 14.5 },
  { nameRu: 'Огурец',                            nameEn: 'Cucumber',                    category: 'Овощи',      kcal: 15,  protein: 0.8,  fat: 0.1,  carbs: 2.5 },
  { nameRu: 'Огурец солёный',                    nameEn: 'Pickled cucumber',            category: 'Овощи',      kcal: 11,  protein: 0.8,  fat: 0.1,  carbs: 1.6 },
  { nameRu: 'Перец болгарский красный',          nameEn: 'Red bell pepper',             category: 'Овощи',      kcal: 31,  protein: 1.0,  fat: 0.3,  carbs: 6.0 },
  { nameRu: 'Перец болгарский зелёный',          nameEn: 'Green bell pepper',           category: 'Овощи',      kcal: 20,  protein: 0.9,  fat: 0.2,  carbs: 3.7 },
  { nameRu: 'Перец болгарский жёлтый',           nameEn: 'Yellow bell pepper',          category: 'Овощи',      kcal: 27,  protein: 1.0,  fat: 0.2,  carbs: 5.3 },
  { nameRu: 'Перец острый чили',                 nameEn: 'Chili pepper',                category: 'Овощи',      kcal: 40,  protein: 1.9,  fat: 0.4,  carbs: 7.3 },
  { nameRu: 'Лук репчатый',                      nameEn: 'Onion',                       category: 'Овощи',      kcal: 41,  protein: 1.4,  fat: 0.2,  carbs: 8.2 },
  { nameRu: 'Лук зелёный',                       nameEn: 'Spring onion',                category: 'Овощи',      kcal: 19,  protein: 1.3,  fat: 0.1,  carbs: 3.2 },
  { nameRu: 'Лук-порей',                         nameEn: 'Leek',                        category: 'Овощи',      kcal: 61,  protein: 1.5,  fat: 0.3,  carbs: 14.2 },
  { nameRu: 'Чеснок',                            nameEn: 'Garlic',                      category: 'Овощи',      kcal: 143, protein: 6.4,  fat: 0.5,  carbs: 29.9 },
  { nameRu: 'Баклажан',                          nameEn: 'Eggplant',                    category: 'Овощи',      kcal: 25,  protein: 1.2,  fat: 0.1,  carbs: 4.5 },
  { nameRu: 'Кабачок',                           nameEn: 'Zucchini',                    category: 'Овощи',      kcal: 24,  protein: 1.2,  fat: 0.3,  carbs: 4.6 },
  { nameRu: 'Тыква',                             nameEn: 'Pumpkin',                     category: 'Овощи',      kcal: 26,  protein: 1.0,  fat: 0.1,  carbs: 4.4 },
  { nameRu: 'Шпинат свежий',                     nameEn: 'Fresh spinach',               category: 'Овощи',      kcal: 23,  protein: 2.9,  fat: 0.4,  carbs: 2.0 },
  { nameRu: 'Шпинат замороженный',               nameEn: 'Frozen spinach',              category: 'Овощи',      kcal: 20,  protein: 2.2,  fat: 0.3,  carbs: 1.7 },
  { nameRu: 'Салат листовой',                    nameEn: 'Lettuce',                     category: 'Овощи',      kcal: 14,  protein: 1.5,  fat: 0.2,  carbs: 1.3 },
  { nameRu: 'Руккола',                           nameEn: 'Arugula',                     category: 'Овощи',      kcal: 25,  protein: 2.6,  fat: 0.7,  carbs: 2.1 },
  { nameRu: 'Айсберг',                           nameEn: 'Iceberg lettuce',             category: 'Овощи',      kcal: 14,  protein: 0.9,  fat: 0.1,  carbs: 2.9 },
  { nameRu: 'Мангольд',                          nameEn: 'Swiss chard',                 category: 'Овощи',      kcal: 19,  protein: 1.8,  fat: 0.2,  carbs: 3.7 },
  { nameRu: 'Кукуруза консервированная',         nameEn: 'Canned corn',                 category: 'Овощи',      kcal: 85,  protein: 2.2,  fat: 1.2,  carbs: 15.6 },
  { nameRu: 'Горошек зелёный консервированный',  nameEn: 'Canned green peas',           category: 'Овощи',      kcal: 55,  protein: 3.6,  fat: 0.2,  carbs: 9.9 },
  { nameRu: 'Фасоль стручковая',                 nameEn: 'Green beans',                 category: 'Овощи',      kcal: 32,  protein: 2.1,  fat: 0.2,  carbs: 5.7 },
  { nameRu: 'Сельдерей стебель',                 nameEn: 'Celery stalk',                category: 'Овощи',      kcal: 13,  protein: 0.9,  fat: 0.1,  carbs: 2.1 },
  { nameRu: 'Сельдерей корень',                  nameEn: 'Celery root',                 category: 'Овощи',      kcal: 42,  protein: 1.5,  fat: 0.3,  carbs: 9.2 },
  { nameRu: 'Редис',                             nameEn: 'Radish',                      category: 'Овощи',      kcal: 20,  protein: 1.2,  fat: 0.1,  carbs: 3.4 },
  { nameRu: 'Редька чёрная',                     nameEn: 'Black radish',                category: 'Овощи',      kcal: 34,  protein: 1.9,  fat: 0.2,  carbs: 6.7 },
  { nameRu: 'Репа',                              nameEn: 'Turnip',                      category: 'Овощи',      kcal: 32,  protein: 1.5,  fat: 0.1,  carbs: 6.4 },
  { nameRu: 'Пастернак',                         nameEn: 'Parsnip',                     category: 'Овощи',      kcal: 75,  protein: 1.4,  fat: 0.5,  carbs: 17.9 },
  { nameRu: 'Топинамбур',                        nameEn: 'Jerusalem artichoke',         category: 'Овощи',      kcal: 61,  protein: 2.1,  fat: 0.0,  carbs: 12.8 },
  { nameRu: 'Артишок',                           nameEn: 'Artichoke',                   category: 'Овощи',      kcal: 47,  protein: 3.3,  fat: 0.2,  carbs: 10.5 },
  { nameRu: 'Спаржа',                            nameEn: 'Asparagus',                   category: 'Овощи',      kcal: 20,  protein: 2.2,  fat: 0.1,  carbs: 3.9 },
  { nameRu: 'Авокадо',                           nameEn: 'Avocado',                     category: 'Овощи',      kcal: 160, protein: 2.0,  fat: 14.7, carbs: 1.8 },
  { nameRu: 'Дайкон (японская редька)',           nameEn: 'Daikon radish',               category: 'Овощи',      kcal: 18,  protein: 0.6,  fat: 0.1,  carbs: 4.1 },
  { nameRu: 'Брокколини',                        nameEn: 'Broccolini',                  category: 'Овощи',      kcal: 35,  protein: 3.7,  fat: 0.5,  carbs: 5.5 },
  // ── Грибы
  { nameRu: 'Грибы шампиньоны свежие',           nameEn: 'Fresh champignon mushrooms',  category: 'Овощи',      kcal: 27,  protein: 4.3,  fat: 1.0,  carbs: 1.0 },
  { nameRu: 'Грибы шампиньоны жареные',          nameEn: 'Fried champignons',           category: 'Овощи',      kcal: 102, protein: 4.0,  fat: 7.5,  carbs: 5.5 },
  { nameRu: 'Грибы вешенки',                     nameEn: 'Oyster mushrooms',            category: 'Овощи',      kcal: 33,  protein: 2.5,  fat: 0.5,  carbs: 6.1 },
  { nameRu: 'Грибы белые свежие',                nameEn: 'Fresh porcini mushrooms',     category: 'Овощи',      kcal: 34,  protein: 3.7,  fat: 1.7,  carbs: 3.4 },
  { nameRu: 'Грибы белые сушёные',               nameEn: 'Dried porcini mushrooms',     category: 'Овощи',      kcal: 282, protein: 30.3, fat: 4.1,  carbs: 38.1 },
  { nameRu: 'Грибы лисички',                     nameEn: 'Chanterelles',                category: 'Овощи',      kcal: 38,  protein: 1.6,  fat: 1.1,  carbs: 7.4 },
  { nameRu: 'Грибы опята',                       nameEn: 'Honey mushrooms',             category: 'Овощи',      kcal: 22,  protein: 2.2,  fat: 1.2,  carbs: 0.5 },
  { nameRu: 'Грибы маринованные',                nameEn: 'Pickled mushrooms',           category: 'Овощи',      kcal: 22,  protein: 1.6,  fat: 0.5,  carbs: 2.9 },

  // ══════════════════════════════════════════════════════════════
  // ФРУКТЫ И ЯГОДЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Яблоко красное',                    nameEn: 'Red apple',                   category: 'Фрукты',     kcal: 52,  protein: 0.3,  fat: 0.2,  carbs: 13.8 },
  { nameRu: 'Яблоко зелёное',                    nameEn: 'Green apple',                 category: 'Фрукты',     kcal: 47,  protein: 0.4,  fat: 0.4,  carbs: 9.8 },
  { nameRu: 'Банан',                             nameEn: 'Banana',                      category: 'Фрукты',     kcal: 89,  protein: 1.5,  fat: 0.2,  carbs: 21.8 },
  { nameRu: 'Апельсин',                          nameEn: 'Orange',                      category: 'Фрукты',     kcal: 43,  protein: 0.9,  fat: 0.2,  carbs: 8.1 },
  { nameRu: 'Мандарин',                          nameEn: 'Mandarin',                    category: 'Фрукты',     kcal: 38,  protein: 0.8,  fat: 0.2,  carbs: 7.5 },
  { nameRu: 'Грейпфрут',                         nameEn: 'Grapefruit',                  category: 'Фрукты',     kcal: 35,  protein: 0.7,  fat: 0.2,  carbs: 6.5 },
  { nameRu: 'Лимон',                             nameEn: 'Lemon',                       category: 'Фрукты',     kcal: 34,  protein: 0.9,  fat: 0.1,  carbs: 3.0 },
  { nameRu: 'Лайм',                              nameEn: 'Lime',                        category: 'Фрукты',     kcal: 30,  protein: 0.7,  fat: 0.2,  carbs: 10.5 },
  { nameRu: 'Помело',                            nameEn: 'Pomelo',                      category: 'Фрукты',     kcal: 38,  protein: 0.8,  fat: 0.1,  carbs: 9.6 },
  { nameRu: 'Груша',                             nameEn: 'Pear',                        category: 'Фрукты',     kcal: 42,  protein: 0.4,  fat: 0.3,  carbs: 9.5 },
  { nameRu: 'Персик',                            nameEn: 'Peach',                       category: 'Фрукты',     kcal: 43,  protein: 0.9,  fat: 0.1,  carbs: 9.5 },
  { nameRu: 'Нектарин',                          nameEn: 'Nectarine',                   category: 'Фрукты',     kcal: 44,  protein: 1.1,  fat: 0.3,  carbs: 10.6 },
  { nameRu: 'Абрикос',                           nameEn: 'Apricot',                     category: 'Фрукты',     kcal: 41,  protein: 0.9,  fat: 0.1,  carbs: 9.0 },
  { nameRu: 'Слива',                             nameEn: 'Plum',                        category: 'Фрукты',     kcal: 49,  protein: 0.8,  fat: 0.3,  carbs: 9.6 },
  { nameRu: 'Вишня',                             nameEn: 'Cherry',                      category: 'Фрукты',     kcal: 52,  protein: 0.8,  fat: 0.5,  carbs: 10.6 },
  { nameRu: 'Черешня',                           nameEn: 'Sweet cherry',                category: 'Фрукты',     kcal: 62,  protein: 1.1,  fat: 0.4,  carbs: 12.8 },
  { nameRu: 'Виноград белый',                    nameEn: 'White grapes',                category: 'Фрукты',     kcal: 65,  protein: 0.6,  fat: 0.2,  carbs: 15.4 },
  { nameRu: 'Виноград красный',                  nameEn: 'Red grapes',                  category: 'Фрукты',     kcal: 70,  protein: 0.7,  fat: 0.2,  carbs: 17.2 },
  { nameRu: 'Арбуз',                             nameEn: 'Watermelon',                  category: 'Фрукты',     kcal: 30,  protein: 0.6,  fat: 0.1,  carbs: 7.6 },
  { nameRu: 'Дыня',                              nameEn: 'Melon',                       category: 'Фрукты',     kcal: 35,  protein: 0.6,  fat: 0.3,  carbs: 7.4 },
  { nameRu: 'Киви',                              nameEn: 'Kiwi',                        category: 'Фрукты',     kcal: 61,  protein: 0.8,  fat: 0.6,  carbs: 14.7 },
  { nameRu: 'Манго',                             nameEn: 'Mango',                       category: 'Фрукты',     kcal: 65,  protein: 0.5,  fat: 0.3,  carbs: 15.2 },
  { nameRu: 'Ананас',                            nameEn: 'Pineapple',                   category: 'Фрукты',     kcal: 50,  protein: 0.5,  fat: 0.2,  carbs: 11.8 },
  { nameRu: 'Папайя',                            nameEn: 'Papaya',                      category: 'Фрукты',     kcal: 43,  protein: 0.5,  fat: 0.3,  carbs: 10.8 },
  { nameRu: 'Хурма',                             nameEn: 'Persimmon',                   category: 'Фрукты',     kcal: 70,  protein: 0.5,  fat: 0.4,  carbs: 18.6 },
  { nameRu: 'Гранат',                            nameEn: 'Pomegranate',                 category: 'Фрукты',     kcal: 83,  protein: 1.7,  fat: 1.2,  carbs: 18.7 },
  { nameRu: 'Инжир свежий',                      nameEn: 'Fresh fig',                   category: 'Фрукты',     kcal: 74,  protein: 0.7,  fat: 0.2,  carbs: 19.2 },
  { nameRu: 'Фейхоа',                            nameEn: 'Feijoa',                      category: 'Фрукты',     kcal: 49,  protein: 1.2,  fat: 0.8,  carbs: 12.4 },
  { nameRu: 'Маракуйя',                          nameEn: 'Passion fruit',               category: 'Фрукты',     kcal: 97,  protein: 2.2,  fat: 0.7,  carbs: 23.4 },
  { nameRu: 'Питахайя (дракон фрукт)',           nameEn: 'Dragon fruit',                category: 'Фрукты',     kcal: 50,  protein: 1.1,  fat: 0.4,  carbs: 11.0 },
  { nameRu: 'Личи',                              nameEn: 'Lychee',                      category: 'Фрукты',     kcal: 66,  protein: 0.8,  fat: 0.4,  carbs: 16.5 },
  // ── Ягоды
  { nameRu: 'Клубника',                          nameEn: 'Strawberry',                  category: 'Фрукты',     kcal: 30,  protein: 0.8,  fat: 0.4,  carbs: 6.9 },
  { nameRu: 'Черника',                           nameEn: 'Blueberry',                   category: 'Фрукты',     kcal: 44,  protein: 0.7,  fat: 0.5,  carbs: 7.6 },
  { nameRu: 'Малина',                            nameEn: 'Raspberry',                   category: 'Фрукты',     kcal: 46,  protein: 0.8,  fat: 0.5,  carbs: 8.3 },
  { nameRu: 'Ежевика',                           nameEn: 'Blackberry',                  category: 'Фрукты',     kcal: 43,  protein: 1.4,  fat: 0.5,  carbs: 9.6 },
  { nameRu: 'Голубика',                          nameEn: 'Bilberry',                    category: 'Фрукты',     kcal: 39,  protein: 1.0,  fat: 0.5,  carbs: 7.7 },
  { nameRu: 'Смородина чёрная',                  nameEn: 'Black currant',               category: 'Фрукты',     kcal: 44,  protein: 1.0,  fat: 0.4,  carbs: 7.3 },
  { nameRu: 'Смородина красная',                 nameEn: 'Red currant',                 category: 'Фрукты',     kcal: 43,  protein: 0.6,  fat: 0.2,  carbs: 7.7 },
  { nameRu: 'Крыжовник',                         nameEn: 'Gooseberry',                  category: 'Фрукты',     kcal: 44,  protein: 0.7,  fat: 0.2,  carbs: 9.1 },
  { nameRu: 'Брусника',                          nameEn: 'Lingonberry',                 category: 'Фрукты',     kcal: 46,  protein: 0.7,  fat: 0.5,  carbs: 8.2 },
  { nameRu: 'Клюква',                            nameEn: 'Cranberry',                   category: 'Фрукты',     kcal: 26,  protein: 0.4,  fat: 0.1,  carbs: 3.8 },
  { nameRu: 'Облепиха',                          nameEn: 'Sea buckthorn',               category: 'Фрукты',     kcal: 82,  protein: 1.2,  fat: 5.4,  carbs: 5.7 },
  { nameRu: 'Шиповник свежий',                   nameEn: 'Rose hip fresh',              category: 'Фрукты',     kcal: 51,  protein: 1.6,  fat: 0.7,  carbs: 24.0 },
  { nameRu: 'Черника замороженная',              nameEn: 'Frozen blueberry',            category: 'Фрукты',     kcal: 56,  protein: 0.7,  fat: 0.3,  carbs: 12.9 },
  { nameRu: 'Клубника замороженная',             nameEn: 'Frozen strawberry',           category: 'Фрукты',     kcal: 35,  protein: 0.8,  fat: 0.4,  carbs: 7.6 },
  { nameRu: 'Малина замороженная',               nameEn: 'Frozen raspberry',            category: 'Фрукты',     kcal: 52,  protein: 0.9,  fat: 0.5,  carbs: 11.6 },
  // ── Сухофрукты
  { nameRu: 'Изюм',                              nameEn: 'Raisins',                     category: 'Фрукты',     kcal: 299, protein: 2.3,  fat: 0.5,  carbs: 71.2 },
  { nameRu: 'Чернослив',                         nameEn: 'Prunes',                      category: 'Фрукты',     kcal: 256, protein: 2.2,  fat: 0.6,  carbs: 57.5 },
  { nameRu: 'Курага',                            nameEn: 'Dried apricots',              category: 'Фрукты',     kcal: 241, protein: 3.4,  fat: 0.4,  carbs: 55.2 },
  { nameRu: 'Финики сушёные',                    nameEn: 'Dried dates',                 category: 'Фрукты',     kcal: 282, protein: 2.5,  fat: 0.4,  carbs: 69.2 },
  { nameRu: 'Инжир сушёный',                     nameEn: 'Dried figs',                  category: 'Фрукты',     kcal: 249, protein: 3.1,  fat: 0.9,  carbs: 63.9 },
  { nameRu: 'Клюква сушёная',                    nameEn: 'Dried cranberry',             category: 'Фрукты',     kcal: 308, protein: 0.1,  fat: 1.4,  carbs: 82.4 },
  { nameRu: 'Яблоки сушёные',                    nameEn: 'Dried apples',                category: 'Фрукты',     kcal: 231, protein: 2.2,  fat: 0.1,  carbs: 59.0 },

  // ══════════════════════════════════════════════════════════════
  // ОРЕХИ И СЕМЕНА
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Миндаль',                           nameEn: 'Almonds',                     category: 'Орехи',      kcal: 575, protein: 21.2, fat: 49.9, carbs: 13.0 },
  { nameRu: 'Грецкий орех',                      nameEn: 'Walnuts',                     category: 'Орехи',      kcal: 654, protein: 15.2, fat: 65.2, carbs: 7.0 },
  { nameRu: 'Арахис',                            nameEn: 'Peanuts',                     category: 'Орехи',      kcal: 552, protein: 26.3, fat: 45.2, carbs: 9.9 },
  { nameRu: 'Кешью',                             nameEn: 'Cashews',                     category: 'Орехи',      kcal: 553, protein: 18.2, fat: 43.9, carbs: 22.5 },
  { nameRu: 'Фундук',                            nameEn: 'Hazelnuts',                   category: 'Орехи',      kcal: 628, protein: 15.0, fat: 61.5, carbs: 9.4 },
  { nameRu: 'Фисташки',                          nameEn: 'Pistachios',                  category: 'Орехи',      kcal: 562, protein: 20.6, fat: 45.4, carbs: 27.2 },
  { nameRu: 'Кедровые орехи',                    nameEn: 'Pine nuts',                   category: 'Орехи',      kcal: 673, protein: 13.7, fat: 68.4, carbs: 13.1 },
  { nameRu: 'Пекан',                             nameEn: 'Pecans',                      category: 'Орехи',      kcal: 691, protein: 9.2,  fat: 72.0, carbs: 13.9 },
  { nameRu: 'Бразильский орех',                  nameEn: 'Brazil nuts',                 category: 'Орехи',      kcal: 659, protein: 14.3, fat: 67.1, carbs: 4.2 },
  { nameRu: 'Макадамия',                         nameEn: 'Macadamia',                   category: 'Орехи',      kcal: 718, protein: 7.9,  fat: 75.8, carbs: 13.8 },
  { nameRu: 'Семена подсолнечника',              nameEn: 'Sunflower seeds',             category: 'Орехи',      kcal: 578, protein: 20.7, fat: 52.9, carbs: 10.5 },
  { nameRu: 'Семена тыквы',                      nameEn: 'Pumpkin seeds',               category: 'Орехи',      kcal: 559, protein: 30.2, fat: 49.1, carbs: 10.7 },
  { nameRu: 'Семена льна',                       nameEn: 'Flaxseeds',                   category: 'Орехи',      kcal: 534, protein: 18.3, fat: 42.2, carbs: 28.9 },
  { nameRu: 'Семена чиа',                        nameEn: 'Chia seeds',                  category: 'Орехи',      kcal: 490, protein: 16.5, fat: 30.7, carbs: 42.1 },
  { nameRu: 'Кунжут',                            nameEn: 'Sesame seeds',                category: 'Орехи',      kcal: 573, protein: 19.4, fat: 48.7, carbs: 12.2 },
  { nameRu: 'Семена конопли',                    nameEn: 'Hemp seeds',                  category: 'Орехи',      kcal: 553, protein: 31.6, fat: 48.8, carbs: 8.7 },
  { nameRu: 'Арахисовая паста',                  nameEn: 'Peanut butter',               category: 'Орехи',      kcal: 588, protein: 25.1, fat: 50.4, carbs: 14.0 },
  { nameRu: 'Миндальная паста',                  nameEn: 'Almond butter',               category: 'Орехи',      kcal: 614, protein: 21.0, fat: 55.0, carbs: 19.0 },
  { nameRu: 'Кокос тёртый',                      nameEn: 'Desiccated coconut',          category: 'Орехи',      kcal: 660, protein: 6.9,  fat: 64.5, carbs: 23.7 },
  { nameRu: 'Кокосовое молоко (консерва)',        nameEn: 'Canned coconut milk',         category: 'Орехи',      kcal: 197, protein: 2.0,  fat: 21.3, carbs: 2.8 },

  // ══════════════════════════════════════════════════════════════
  // МАСЛА И ЖИРЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Масло подсолнечное',                nameEn: 'Sunflower oil',               category: 'Масла',      kcal: 899, protein: 0.0,  fat: 99.9, carbs: 0.0 },
  { nameRu: 'Масло оливковое',                   nameEn: 'Olive oil',                   category: 'Масла',      kcal: 884, protein: 0.0,  fat: 99.8, carbs: 0.0 },
  { nameRu: 'Масло кокосовое',                   nameEn: 'Coconut oil',                 category: 'Масла',      kcal: 862, protein: 0.0,  fat: 99.1, carbs: 0.0 },
  { nameRu: 'Масло льняное',                     nameEn: 'Flaxseed oil',                category: 'Масла',      kcal: 884, protein: 0.0,  fat: 99.8, carbs: 0.0 },
  { nameRu: 'Масло рапсовое',                    nameEn: 'Canola oil',                  category: 'Масла',      kcal: 884, protein: 0.0,  fat: 100.0, carbs: 0.0 },
  { nameRu: 'Масло кукурузное',                  nameEn: 'Corn oil',                    category: 'Масла',      kcal: 899, protein: 0.0,  fat: 99.9, carbs: 0.0 },
  { nameRu: 'Масло авокадо',                     nameEn: 'Avocado oil',                 category: 'Масла',      kcal: 884, protein: 0.0,  fat: 100.0, carbs: 0.0 },
  { nameRu: 'Масло грецкого ореха',              nameEn: 'Walnut oil',                  category: 'Масла',      kcal: 884, protein: 0.0,  fat: 99.8, carbs: 0.0 },
  { nameRu: 'Масло тыквенных семечек',           nameEn: 'Pumpkin seed oil',            category: 'Масла',      kcal: 884, protein: 0.0,  fat: 100.0, carbs: 0.0 },
  { nameRu: 'Маргарин',                          nameEn: 'Margarine',                   category: 'Масла',      kcal: 718, protein: 0.3,  fat: 80.0, carbs: 1.0 },
  { nameRu: 'Майонез Провансаль 67%',            nameEn: 'Mayonnaise 67%',              category: 'Масла',      kcal: 621, protein: 2.8,  fat: 67.0, carbs: 2.6 },
  { nameRu: 'Майонез лёгкий 25%',               nameEn: 'Light mayonnaise 25%',        category: 'Масла',      kcal: 260, protein: 2.6,  fat: 25.0, carbs: 9.0 },
  { nameRu: 'Топлёное масло (гхи)',              nameEn: 'Ghee clarified butter',       category: 'Масла',      kcal: 900, protein: 0.0,  fat: 99.8, carbs: 0.2 },
  { nameRu: 'Смалец (свиной жир)',               nameEn: 'Lard',                        category: 'Масла',      kcal: 897, protein: 0.0,  fat: 99.6, carbs: 0.0 },

  // ══════════════════════════════════════════════════════════════
  // СОУСЫ, СПЕЦИИ, ПРИПРАВЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Кетчуп',                            nameEn: 'Ketchup',                     category: 'Соусы',      kcal: 93,  protein: 1.8,  fat: 0.1,  carbs: 22.0 },
  { nameRu: 'Горчица',                           nameEn: 'Mustard',                     category: 'Соусы',      kcal: 162, protein: 10.6, fat: 10.4, carbs: 5.3 },
  { nameRu: 'Соевый соус',                       nameEn: 'Soy sauce',                   category: 'Соусы',      kcal: 53,  protein: 8.1,  fat: 0.0,  carbs: 4.9 },
  { nameRu: 'Соус песто',                        nameEn: 'Pesto sauce',                 category: 'Соусы',      kcal: 421, protein: 6.0,  fat: 40.6, carbs: 13.0 },
  { nameRu: 'Хумус',                             nameEn: 'Hummus',                      category: 'Соусы',      kcal: 177, protein: 7.9,  fat: 10.6, carbs: 16.9 },
  { nameRu: 'Сальса',                            nameEn: 'Salsa',                       category: 'Соусы',      kcal: 36,  protein: 1.4,  fat: 0.3,  carbs: 7.7 },
  { nameRu: 'Аджика',                            nameEn: 'Adjika hot sauce',            category: 'Соусы',      kcal: 59,  protein: 1.8,  fat: 1.6,  carbs: 9.5 },
  { nameRu: 'Ткемали',                           nameEn: 'Tkemali plum sauce',          category: 'Соусы',      kcal: 68,  protein: 0.5,  fat: 0.0,  carbs: 17.0 },
  { nameRu: 'Соус Табаско',                      nameEn: 'Tabasco sauce',               category: 'Соусы',      kcal: 12,  protein: 0.5,  fat: 0.2,  carbs: 2.1 },
  { nameRu: 'Вустерский соус',                   nameEn: 'Worcestershire sauce',        category: 'Соусы',      kcal: 78,  protein: 1.3,  fat: 0.1,  carbs: 19.5 },
  { nameRu: 'Соус Терияки',                      nameEn: 'Teriyaki sauce',              category: 'Соусы',      kcal: 89,  protein: 5.0,  fat: 0.0,  carbs: 17.2 },
  { nameRu: 'Соус для суши (имбирь маринованный)', nameEn: 'Pickled ginger sushi',     category: 'Соусы',      kcal: 60,  protein: 0.2,  fat: 0.1,  carbs: 15.0 },
  { nameRu: 'Оливки чёрные',                     nameEn: 'Black olives',                category: 'Соусы',      kcal: 361, protein: 2.3,  fat: 35.8, carbs: 8.7 },
  { nameRu: 'Оливки зелёные',                    nameEn: 'Green olives',                category: 'Соусы',      kcal: 145, protein: 1.0,  fat: 15.3, carbs: 1.3 },
  { nameRu: 'Уксус яблочный',                    nameEn: 'Apple cider vinegar',         category: 'Соусы',      kcal: 21,  protein: 0.0,  fat: 0.0,  carbs: 0.9 },
  { nameRu: 'Уксус бальзамический',              nameEn: 'Balsamic vinegar',            category: 'Соусы',      kcal: 88,  protein: 0.5,  fat: 0.0,  carbs: 17.0 },
  // ── Специи (значимые кКал)
  { nameRu: 'Корица молотая',                    nameEn: 'Ground cinnamon',             category: 'Соусы',      kcal: 247, protein: 4.0,  fat: 1.2,  carbs: 80.6 },
  { nameRu: 'Куркума',                           nameEn: 'Turmeric',                    category: 'Соусы',      kcal: 354, protein: 7.8,  fat: 9.9,  carbs: 64.9 },
  { nameRu: 'Перец чёрный молотый',              nameEn: 'Black pepper ground',         category: 'Соусы',      kcal: 255, protein: 10.4, fat: 3.3,  carbs: 38.3 },
  { nameRu: 'Паприка сладкая',                   nameEn: 'Sweet paprika',               category: 'Соусы',      kcal: 282, protein: 14.1, fat: 12.9, carbs: 53.9 },
  { nameRu: 'Карри порошок',                     nameEn: 'Curry powder',                category: 'Соусы',      kcal: 325, protein: 14.3, fat: 14.0, carbs: 55.8 },
  { nameRu: 'Имбирь молотый',                    nameEn: 'Ground ginger',               category: 'Соусы',      kcal: 335, protein: 9.1,  fat: 4.2,  carbs: 71.6 },
  { nameRu: 'Кориандр молотый',                  nameEn: 'Ground coriander',            category: 'Соусы',      kcal: 298, protein: 12.4, fat: 17.8, carbs: 54.9 },
  { nameRu: 'Тмин молотый',                      nameEn: 'Ground cumin',                category: 'Соусы',      kcal: 375, protein: 17.8, fat: 22.3, carbs: 44.2 },
  { nameRu: 'Орегано сушёный',                   nameEn: 'Dried oregano',               category: 'Соусы',      kcal: 265, protein: 9.0,  fat: 4.3,  carbs: 64.4 },
  { nameRu: 'Базилик сушёный',                   nameEn: 'Dried basil',                 category: 'Соусы',      kcal: 233, protein: 22.9, fat: 4.0,  carbs: 47.8 },
  { nameRu: 'Соль',                              nameEn: 'Salt',                        category: 'Соусы',      kcal: 0,   protein: 0.0,  fat: 0.0,  carbs: 0.0 },

  // ══════════════════════════════════════════════════════════════
  // НАПИТКИ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Вода',                              nameEn: 'Water',                       category: 'Напитки',    kcal: 0,   protein: 0.0,  fat: 0.0,  carbs: 0.0 },
  { nameRu: 'Кофе чёрный (без сахара)',          nameEn: 'Black coffee',                category: 'Напитки',    kcal: 2,   protein: 0.2,  fat: 0.0,  carbs: 0.3 },
  { nameRu: 'Кофе с молоком (200мл)',            nameEn: 'Coffee with milk 200ml',      category: 'Напитки',    kcal: 58,  protein: 2.9,  fat: 2.3,  carbs: 6.2 },
  { nameRu: 'Капучино (250мл)',                  nameEn: 'Cappuccino 250ml',            category: 'Напитки',    kcal: 74,  protein: 4.3,  fat: 3.1,  carbs: 7.2 },
  { nameRu: 'Латте (350мл)',                     nameEn: 'Latte 350ml',                 category: 'Напитки',    kcal: 135, protein: 7.3,  fat: 5.4,  carbs: 13.5 },
  { nameRu: 'Американо (200мл)',                 nameEn: 'Americano 200ml',             category: 'Напитки',    kcal: 5,   protein: 0.5,  fat: 0.0,  carbs: 0.6 },
  { nameRu: 'Раф кофе (300мл)',                  nameEn: 'Raf coffee 300ml',            category: 'Напитки',    kcal: 213, protein: 5.4,  fat: 11.5, carbs: 22.5 },
  { nameRu: 'Чай чёрный (без сахара)',           nameEn: 'Black tea',                   category: 'Напитки',    kcal: 1,   protein: 0.0,  fat: 0.0,  carbs: 0.0 },
  { nameRu: 'Чай зелёный',                       nameEn: 'Green tea',                   category: 'Напитки',    kcal: 1,   protein: 0.0,  fat: 0.0,  carbs: 0.0 },
  { nameRu: 'Чай с молоком и сахаром',           nameEn: 'Tea with milk and sugar',     category: 'Напитки',    kcal: 36,  protein: 0.7,  fat: 0.8,  carbs: 6.5 },
  { nameRu: 'Какао на молоке',                   nameEn: 'Cocoa with milk',             category: 'Напитки',    kcal: 97,  protein: 4.5,  fat: 4.0,  carbs: 11.9 },
  { nameRu: 'Сок апельсиновый',                  nameEn: 'Orange juice',                category: 'Напитки',    kcal: 47,  protein: 0.7,  fat: 0.2,  carbs: 10.4 },
  { nameRu: 'Сок яблочный',                      nameEn: 'Apple juice',                 category: 'Напитки',    kcal: 46,  protein: 0.5,  fat: 0.1,  carbs: 10.9 },
  { nameRu: 'Сок томатный',                      nameEn: 'Tomato juice',                category: 'Напитки',    kcal: 21,  protein: 1.0,  fat: 0.1,  carbs: 4.2 },
  { nameRu: 'Сок виноградный',                   nameEn: 'Grape juice',                 category: 'Напитки',    kcal: 63,  protein: 0.6,  fat: 0.3,  carbs: 14.9 },
  { nameRu: 'Сок морковный',                     nameEn: 'Carrot juice',                category: 'Напитки',    kcal: 28,  protein: 0.9,  fat: 0.1,  carbs: 6.0 },
  { nameRu: 'Кола',                              nameEn: 'Cola',                        category: 'Напитки',    kcal: 42,  protein: 0.0,  fat: 0.0,  carbs: 10.6 },
  { nameRu: 'Лимонад (газировка)',               nameEn: 'Lemonade soda',               category: 'Напитки',    kcal: 40,  protein: 0.0,  fat: 0.0,  carbs: 10.0 },
  { nameRu: 'Молоко овсяное',                    nameEn: 'Oat milk',                    category: 'Напитки',    kcal: 46,  protein: 1.0,  fat: 1.5,  carbs: 6.6 },
  { nameRu: 'Молоко миндальное',                 nameEn: 'Almond milk',                 category: 'Напитки',    kcal: 24,  protein: 0.9,  fat: 1.4,  carbs: 1.6 },
  { nameRu: 'Молоко соевое',                     nameEn: 'Soy milk',                    category: 'Напитки',    kcal: 54,  protein: 3.3,  fat: 1.8,  carbs: 6.3 },
  { nameRu: 'Молоко кокосовое (напиток)',         nameEn: 'Coconut milk drink',          category: 'Напитки',    kcal: 21,  protein: 0.2,  fat: 2.1,  carbs: 1.5 },
  { nameRu: 'Протеиновый коктейль',              nameEn: 'Protein shake',               category: 'Напитки',    kcal: 113, protein: 20.0, fat: 1.5,  carbs: 5.0 },
  { nameRu: 'Смузи банан+молоко',                nameEn: 'Banana milk smoothie',        category: 'Напитки',    kcal: 96,  protein: 3.2,  fat: 1.6,  carbs: 17.5 },
  { nameRu: 'Квас',                              nameEn: 'Kvas',                        category: 'Напитки',    kcal: 27,  protein: 0.2,  fat: 0.0,  carbs: 5.2 },
  { nameRu: 'Компот из сухофруктов',             nameEn: 'Dried fruit compote',         category: 'Напитки',    kcal: 60,  protein: 0.4,  fat: 0.0,  carbs: 14.5 },
  { nameRu: 'Морс клюквенный',                   nameEn: 'Cranberry fruit drink',       category: 'Напитки',    kcal: 45,  protein: 0.1,  fat: 0.0,  carbs: 11.2 },
  { nameRu: 'Кисель',                            nameEn: 'Kissel berry drink',          category: 'Напитки',    kcal: 55,  protein: 0.0,  fat: 0.0,  carbs: 13.8 },
  // ── Алкоголь
  { nameRu: 'Пиво светлое (алк 4.5%)',           nameEn: 'Light beer 4.5% alcohol',     category: 'Напитки',    kcal: 43,  protein: 0.5,  fat: 0.0,  carbs: 3.5 },
  { nameRu: 'Пиво тёмное (алк 5%)',              nameEn: 'Dark beer 5% alcohol',        category: 'Напитки',    kcal: 60,  protein: 0.6,  fat: 0.0,  carbs: 5.0 },
  { nameRu: 'Вино красное сухое',                nameEn: 'Red dry wine',                category: 'Напитки',    kcal: 68,  protein: 0.2,  fat: 0.0,  carbs: 2.1 },
  { nameRu: 'Вино белое сухое',                  nameEn: 'White dry wine',              category: 'Напитки',    kcal: 66,  protein: 0.1,  fat: 0.0,  carbs: 1.4 },
  { nameRu: 'Шампанское полусладкое',            nameEn: 'Semi-sweet champagne',        category: 'Напитки',    kcal: 90,  protein: 0.3,  fat: 0.0,  carbs: 11.0 },
  { nameRu: 'Водка (40%)',                       nameEn: 'Vodka 40%',                   category: 'Напитки',    kcal: 235, protein: 0.0,  fat: 0.0,  carbs: 0.1 },
  { nameRu: 'Коньяк (40%)',                      nameEn: 'Cognac 40%',                  category: 'Напитки',    kcal: 239, protein: 0.0,  fat: 0.0,  carbs: 0.1 },
  { nameRu: 'Виски (40%)',                       nameEn: 'Whiskey 40%',                 category: 'Напитки',    kcal: 220, protein: 0.0,  fat: 0.0,  carbs: 0.0 },

  // ══════════════════════════════════════════════════════════════
  // ГОТОВЫЕ БЛЮДА
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Борщ',                              nameEn: 'Borscht',                     category: 'Блюда',      kcal: 57,  protein: 2.8,  fat: 2.5,  carbs: 5.2 },
  { nameRu: 'Щи',                                nameEn: 'Shchi cabbage soup',          category: 'Блюда',      kcal: 32,  protein: 2.1,  fat: 1.2,  carbs: 3.8 },
  { nameRu: 'Суп куриный с лапшой',             nameEn: 'Chicken noodle soup',         category: 'Блюда',      kcal: 36,  protein: 3.2,  fat: 1.5,  carbs: 2.0 },
  { nameRu: 'Уха рыбная',                        nameEn: 'Fish soup ukha',              category: 'Блюда',      kcal: 45,  protein: 5.2,  fat: 1.5,  carbs: 2.8 },
  { nameRu: 'Рассольник',                        nameEn: 'Rassolnik pickle soup',       category: 'Блюда',      kcal: 42,  protein: 2.6,  fat: 2.0,  carbs: 4.0 },
  { nameRu: 'Солянка мясная',                    nameEn: 'Solyanka meat soup',          category: 'Блюда',      kcal: 72,  protein: 5.0,  fat: 4.5,  carbs: 3.5 },
  { nameRu: 'Гороховый суп с копчёностями',      nameEn: 'Pea soup smoked meat',        category: 'Блюда',      kcal: 75,  protein: 5.5,  fat: 2.8,  carbs: 9.5 },
  { nameRu: 'Суп-пюре тыквенный',               nameEn: 'Pumpkin cream soup',          category: 'Блюда',      kcal: 52,  protein: 1.5,  fat: 2.5,  carbs: 7.0 },
  { nameRu: 'Окрошка на кефире',                 nameEn: 'Okroshka on kefir',           category: 'Блюда',      kcal: 48,  protein: 3.2,  fat: 1.5,  carbs: 4.8 },
  { nameRu: 'Котлеты домашние',                  nameEn: 'Homemade meat patties',       category: 'Блюда',      kcal: 245, protein: 14.6, fat: 17.8, carbs: 6.2 },
  { nameRu: 'Котлеты куриные',                   nameEn: 'Chicken patties',             category: 'Блюда',      kcal: 175, protein: 14.0, fat: 10.5, carbs: 5.8 },
  { nameRu: 'Котлеты паровые',                   nameEn: 'Steamed meat patties',        category: 'Блюда',      kcal: 175, protein: 14.0, fat: 9.2,  carbs: 5.0 },
  { nameRu: 'Тефтели в соусе',                   nameEn: 'Meatballs in tomato sauce',   category: 'Блюда',      kcal: 194, protein: 13.0, fat: 12.5, carbs: 7.6 },
  { nameRu: 'Голубцы',                           nameEn: 'Stuffed cabbage rolls',       category: 'Блюда',      kcal: 175, protein: 10.0, fat: 9.5,  carbs: 12.5 },
  { nameRu: 'Пельмени',                          nameEn: 'Pelmeni dumplings',           category: 'Блюда',      kcal: 275, protein: 11.9, fat: 13.5, carbs: 26.0 },
  { nameRu: 'Вареники с картошкой',              nameEn: 'Potato varenyky',             category: 'Блюда',      kcal: 197, protein: 5.8,  fat: 3.6,  carbs: 34.8 },
  { nameRu: 'Вареники с творогом',               nameEn: 'Curd cheese varenyky',        category: 'Блюда',      kcal: 230, protein: 9.5,  fat: 4.8,  carbs: 37.0 },
  { nameRu: 'Манты',                             nameEn: 'Manti steamed dumplings',     category: 'Блюда',      kcal: 220, protein: 10.0, fat: 9.5,  carbs: 24.5 },
  { nameRu: 'Хинкали',                           nameEn: 'Khinkali Georgian dumplings', category: 'Блюда',      kcal: 192, protein: 10.8, fat: 8.0,  carbs: 21.5 },
  { nameRu: 'Оливье',                            nameEn: 'Olivier Russian salad',       category: 'Блюда',      kcal: 198, protein: 6.5,  fat: 15.4, carbs: 9.5 },
  { nameRu: 'Винегрет',                          nameEn: 'Vinegret beet salad',         category: 'Блюда',      kcal: 73,  protein: 1.7,  fat: 3.5,  carbs: 8.7 },
  { nameRu: 'Греческий салат',                   nameEn: 'Greek salad',                 category: 'Блюда',      kcal: 96,  protein: 3.2,  fat: 7.5,  carbs: 5.0 },
  { nameRu: 'Цезарь с курицей',                  nameEn: 'Caesar salad with chicken',   category: 'Блюда',      kcal: 220, protein: 17.0, fat: 14.5, carbs: 5.5 },
  { nameRu: 'Яичница глазунья 2 яйца',           nameEn: 'Fried eggs sunny side up',    category: 'Блюда',      kcal: 185, protein: 13.6, fat: 14.5, carbs: 0.7 },
  { nameRu: 'Омлет с молоком',                   nameEn: 'Omelette with milk',          category: 'Блюда',      kcal: 184, protein: 10.5, fat: 14.8, carbs: 2.7 },
  { nameRu: 'Яйца варёные вкрутую',              nameEn: 'Hard boiled eggs',            category: 'Блюда',      kcal: 155, protein: 12.6, fat: 10.6, carbs: 0.6 },
  { nameRu: 'Яйца пашот',                        nameEn: 'Poached eggs',                category: 'Блюда',      kcal: 147, protein: 12.5, fat: 9.5,  carbs: 0.7 },
  { nameRu: 'Скрэмбл',                           nameEn: 'Scrambled eggs',              category: 'Блюда',      kcal: 170, protein: 10.5, fat: 13.8, carbs: 1.5 },
  { nameRu: 'Блины',                             nameEn: 'Blini Russian pancakes',      category: 'Блюда',      kcal: 206, protein: 6.1,  fat: 8.3,  carbs: 26.3 },
  { nameRu: 'Оладьи',                            nameEn: 'Thick Russian pancakes',      category: 'Блюда',      kcal: 237, protein: 6.8,  fat: 9.8,  carbs: 30.0 },
  { nameRu: 'Сырники',                           nameEn: 'Curd cheese pancakes',        category: 'Блюда',      kcal: 243, protein: 13.8, fat: 8.5,  carbs: 28.5 },
  { nameRu: 'Каша гречневая с маслом',           nameEn: 'Buckwheat porridge with butter', category: 'Блюда',   kcal: 163, protein: 4.2,  fat: 5.9,  carbs: 24.0 },
  { nameRu: 'Каша рисовая молочная',             nameEn: 'Rice milk porridge',          category: 'Блюда',      kcal: 97,  protein: 2.8,  fat: 2.1,  carbs: 16.4 },
  { nameRu: 'Каша овсяная на молоке',            nameEn: 'Oatmeal with milk',           category: 'Блюда',      kcal: 102, protein: 3.7,  fat: 3.3,  carbs: 14.0 },
  { nameRu: 'Каша пшённая на молоке',            nameEn: 'Millet milk porridge',        category: 'Блюда',      kcal: 120, protein: 4.0,  fat: 4.5,  carbs: 16.5 },
  { nameRu: 'Пицца Маргарита',                   nameEn: 'Pizza Margherita',            category: 'Блюда',      kcal: 250, protein: 11.0, fat: 8.5,  carbs: 33.0 },
  { nameRu: 'Пицца Пепперони',                   nameEn: 'Pizza Pepperoni',             category: 'Блюда',      kcal: 290, protein: 13.0, fat: 12.0, carbs: 32.0 },
  { nameRu: 'Роллы Калифорния',                  nameEn: 'California roll',             category: 'Блюда',      kcal: 145, protein: 7.0,  fat: 3.5,  carbs: 21.0 },
  { nameRu: 'Роллы с лососем',                   nameEn: 'Salmon roll',                 category: 'Блюда',      kcal: 162, protein: 8.5,  fat: 5.0,  carbs: 21.0 },
  { nameRu: 'Роллы Филадельфия',                 nameEn: 'Philadelphia roll',           category: 'Блюда',      kcal: 175, protein: 9.0,  fat: 7.5,  carbs: 18.0 },
  { nameRu: 'Суши нигири с тунцом',              nameEn: 'Tuna nigiri sushi',           category: 'Блюда',      kcal: 145, protein: 11.0, fat: 1.5,  carbs: 21.0 },
  { nameRu: 'Шаурма с курицей',                  nameEn: 'Chicken shawarma',            category: 'Блюда',      kcal: 264, protein: 14.0, fat: 13.0, carbs: 24.0 },
  { nameRu: 'Бургер классический',               nameEn: 'Classic burger',              category: 'Блюда',      kcal: 295, protein: 17.0, fat: 14.0, carbs: 25.0 },
  { nameRu: 'Картофель фри',                     nameEn: 'French fries',                category: 'Блюда',      kcal: 312, protein: 3.4,  fat: 15.0, carbs: 41.0 },
  { nameRu: 'Хот-дог',                           nameEn: 'Hot dog',                     category: 'Блюда',      kcal: 290, protein: 10.9, fat: 17.0, carbs: 24.0 },
  { nameRu: 'Плов',                              nameEn: 'Plov rice pilaf',             category: 'Блюда',      kcal: 220, protein: 8.0,  fat: 9.0,  carbs: 28.0 },
  { nameRu: 'Куриный шашлык',                    nameEn: 'Chicken shashlik',            category: 'Блюда',      kcal: 165, protein: 24.0, fat: 7.0,  carbs: 0.8 },
  { nameRu: 'Шашлык из свинины',                 nameEn: 'Pork shashlik',               category: 'Блюда',      kcal: 258, protein: 18.0, fat: 20.5, carbs: 0.5 },
  { nameRu: 'Сэндвич с ветчиной и сыром',        nameEn: 'Ham and cheese sandwich',     category: 'Блюда',      kcal: 244, protein: 12.0, fat: 10.0, carbs: 27.0 },
  { nameRu: 'Тост с арахисовой пастой',          nameEn: 'Toast with peanut butter',    category: 'Блюда',      kcal: 370, protein: 12.0, fat: 16.5, carbs: 45.0 },
  { nameRu: 'Яйца Бенедикт',                    nameEn: 'Eggs Benedict',               category: 'Блюда',      kcal: 330, protein: 18.0, fat: 20.0, carbs: 18.0 },

  // ══════════════════════════════════════════════════════════════
  // СЛАДКОЕ И ДЕСЕРТЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Шоколад тёмный 70%',                nameEn: 'Dark chocolate 70%',          category: 'Сладкое',    kcal: 539, protein: 8.1,  fat: 35.3, carbs: 47.9 },
  { nameRu: 'Шоколад тёмный 85%',                nameEn: 'Dark chocolate 85%',          category: 'Сладкое',    kcal: 598, protein: 11.0, fat: 44.0, carbs: 37.0 },
  { nameRu: 'Шоколад молочный',                  nameEn: 'Milk chocolate',              category: 'Сладкое',    kcal: 535, protein: 6.9,  fat: 29.5, carbs: 59.4 },
  { nameRu: 'Шоколад белый',                     nameEn: 'White chocolate',             category: 'Сладкое',    kcal: 544, protein: 6.3,  fat: 30.9, carbs: 59.2 },
  { nameRu: 'Мёд',                               nameEn: 'Honey',                       category: 'Сладкое',    kcal: 328, protein: 0.8,  fat: 0.0,  carbs: 81.5 },
  { nameRu: 'Сахар белый',                       nameEn: 'White sugar',                 category: 'Сладкое',    kcal: 399, protein: 0.0,  fat: 0.0,  carbs: 99.7 },
  { nameRu: 'Сахар коричневый',                  nameEn: 'Brown sugar',                 category: 'Сладкое',    kcal: 377, protein: 0.0,  fat: 0.0,  carbs: 97.0 },
  { nameRu: 'Сироп кленовый',                    nameEn: 'Maple syrup',                 category: 'Сладкое',    kcal: 260, protein: 0.0,  fat: 0.1,  carbs: 67.0 },
  { nameRu: 'Сироп агавы',                       nameEn: 'Agave syrup',                 category: 'Сладкое',    kcal: 310, protein: 0.1,  fat: 0.2,  carbs: 76.0 },
  { nameRu: 'Варенье клубничное',                nameEn: 'Strawberry jam',              category: 'Сладкое',    kcal: 238, protein: 0.4,  fat: 0.2,  carbs: 60.5 },
  { nameRu: 'Варенье абрикосовое',               nameEn: 'Apricot jam',                 category: 'Сладкое',    kcal: 241, protein: 0.4,  fat: 0.1,  carbs: 62.0 },
  { nameRu: 'Варенье черничное',                 nameEn: 'Blueberry jam',               category: 'Сладкое',    kcal: 228, protein: 0.3,  fat: 0.2,  carbs: 57.0 },
  { nameRu: 'Нутелла',                           nameEn: 'Nutella hazelnut spread',     category: 'Сладкое',    kcal: 539, protein: 6.3,  fat: 31.0, carbs: 57.5 },
  { nameRu: 'Зефир',                             nameEn: 'Zephyr marshmallow',          category: 'Сладкое',    kcal: 304, protein: 0.8,  fat: 0.1,  carbs: 72.9 },
  { nameRu: 'Мармелад',                          nameEn: 'Marmalade',                   category: 'Сладкое',    kcal: 293, protein: 0.4,  fat: 0.1,  carbs: 71.6 },
  { nameRu: 'Халва подсолнечная',                nameEn: 'Sunflower halva',             category: 'Сладкое',    kcal: 523, protein: 12.0, fat: 30.0, carbs: 54.0 },
  { nameRu: 'Пастила',                           nameEn: 'Pastila Russian sweet',       category: 'Сладкое',    kcal: 310, protein: 0.5,  fat: 0.1,  carbs: 79.8 },
  { nameRu: 'Карамель',                          nameEn: 'Caramel candy',               category: 'Сладкое',    kcal: 382, protein: 0.3,  fat: 2.0,  carbs: 92.0 },
  { nameRu: 'Ириски',                            nameEn: 'Toffee candy',                category: 'Сладкое',    kcal: 440, protein: 3.3,  fat: 10.0, carbs: 82.0 },
  { nameRu: 'Торт Наполеон',                     nameEn: 'Napoleon layer cake',         category: 'Сладкое',    kcal: 407, protein: 5.6,  fat: 22.5, carbs: 49.0 },
  { nameRu: 'Торт Медовик',                      nameEn: 'Honey cake',                  category: 'Сладкое',    kcal: 392, protein: 6.2,  fat: 18.0, carbs: 52.0 },
  { nameRu: 'Торт Прага',                        nameEn: 'Prague chocolate cake',       category: 'Сладкое',    kcal: 426, protein: 5.8,  fat: 24.5, carbs: 50.0 },
  { nameRu: 'Торт Птичье молоко',                nameEn: 'Bird milk cake',              category: 'Сладкое',    kcal: 357, protein: 5.2,  fat: 18.0, carbs: 44.0 },
  { nameRu: 'Шарлотка',                          nameEn: 'Charlotte apple cake',        category: 'Сладкое',    kcal: 231, protein: 5.2,  fat: 7.0,  carbs: 37.8 },
  { nameRu: 'Пирог с яблоками',                  nameEn: 'Apple pie',                   category: 'Сладкое',    kcal: 261, protein: 4.0,  fat: 9.5,  carbs: 42.0 },
  { nameRu: 'Эклер',                             nameEn: 'Eclair',                      category: 'Сладкое',    kcal: 330, protein: 7.5,  fat: 16.0, carbs: 39.0 },
  { nameRu: 'Тирамису',                          nameEn: 'Tiramisu',                    category: 'Сладкое',    kcal: 264, protein: 7.1,  fat: 16.0, carbs: 24.0 },
  { nameRu: 'Чизкейк Нью-Йорк',                 nameEn: 'New York cheesecake',         category: 'Сладкое',    kcal: 340, protein: 7.0,  fat: 23.5, carbs: 26.5 },
  { nameRu: 'Панна котта',                       nameEn: 'Panna cotta',                 category: 'Сладкое',    kcal: 248, protein: 4.2,  fat: 18.0, carbs: 18.0 },
  { nameRu: 'Конфеты шоколадные',                nameEn: 'Chocolate candies',           category: 'Сладкое',    kcal: 498, protein: 7.5,  fat: 24.5, carbs: 63.0 },
  { nameRu: 'Козинак подсолнечный',              nameEn: 'Sunflower seed brittle',      category: 'Сладкое',    kcal: 520, protein: 14.0, fat: 30.0, carbs: 53.0 },

  // ══════════════════════════════════════════════════════════════
  // СПОРТИВНОЕ ПИТАНИЕ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Протеин сывороточный (порошок)',    nameEn: 'Whey protein powder',         category: 'Спортпит',   kcal: 380, protein: 74.0, fat: 5.0,  carbs: 10.0 },
  { nameRu: 'Казеиновый протеин (порошок)',      nameEn: 'Casein protein powder',       category: 'Спортпит',   kcal: 370, protein: 76.0, fat: 3.0,  carbs: 8.0 },
  { nameRu: 'Яичный протеин (порошок)',          nameEn: 'Egg white protein powder',    category: 'Спортпит',   kcal: 390, protein: 78.0, fat: 3.0,  carbs: 7.0 },
  { nameRu: 'Соевый протеин (порошок)',          nameEn: 'Soy protein powder',          category: 'Спортпит',   kcal: 338, protein: 66.0, fat: 3.4,  carbs: 14.0 },
  { nameRu: 'Гейнер',                            nameEn: 'Mass gainer powder',          category: 'Спортпит',   kcal: 387, protein: 20.0, fat: 4.0,  carbs: 72.0 },
  { nameRu: 'BCAA (порошок)',                    nameEn: 'BCAA powder',                 category: 'Спортпит',   kcal: 100, protein: 25.0, fat: 0.0,  carbs: 0.0 },
  { nameRu: 'Протеиновый батончик',              nameEn: 'Protein bar',                 category: 'Спортпит',   kcal: 350, protein: 25.0, fat: 8.0,  carbs: 38.0 },
  { nameRu: 'Изотоник (спортивный напиток)',     nameEn: 'Isotonic sports drink',       category: 'Спортпит',   kcal: 25,  protein: 0.0,  fat: 0.0,  carbs: 6.0 },
  { nameRu: 'Протеиновые панкейки (порошок)',    nameEn: 'Protein pancake mix',         category: 'Спортпит',   kcal: 340, protein: 40.0, fat: 4.0,  carbs: 35.0 },

  // ══════════════════════════════════════════════════════════════
  // ФАСТФУД И ПОЛУФАБРИКАТЫ
  // ══════════════════════════════════════════════════════════════
  { nameRu: 'Лапша быстрого приготовления (сухая)', nameEn: 'Instant ramen noodles dry', category: 'Фастфуд',  kcal: 352, protein: 8.5,  fat: 13.5, carbs: 50.5 },
  { nameRu: 'Пюре картофельное быстрое (порошок)', nameEn: 'Instant mashed potato',    category: 'Фастфуд',    kcal: 350, protein: 7.3,  fat: 1.1,  carbs: 77.4 },
  { nameRu: 'Каша овсяная быстрая (пакет)',       nameEn: 'Instant oatmeal packet',     category: 'Фастфуд',    kcal: 372, protein: 9.5,  fat: 5.0,  carbs: 71.0 },
  { nameRu: 'Чипсы картофельные',                 nameEn: 'Potato chips',               category: 'Фастфуд',    kcal: 536, protein: 6.0,  fat: 33.3, carbs: 53.5 },
  { nameRu: 'Сухарики ржаные (снэк)',             nameEn: 'Rye crouton snacks',         category: 'Фастфуд',    kcal: 351, protein: 10.5, fat: 5.7,  carbs: 64.0 },
  { nameRu: 'Поп-корн несолёный',                 nameEn: 'Unsalted popcorn',           category: 'Фастфуд',    kcal: 387, protein: 13.1, fat: 4.5,  carbs: 74.3 },
  { nameRu: 'Поп-корн карамельный',               nameEn: 'Caramel popcorn',            category: 'Фастфуд',    kcal: 424, protein: 5.7,  fat: 8.0,  carbs: 83.0 },
  { nameRu: 'Наггетсы куриные',                   nameEn: 'Chicken nuggets',            category: 'Фастфуд',    kcal: 297, protein: 14.0, fat: 18.3, carbs: 19.4 },
  { nameRu: 'Пицца замороженная',                 nameEn: 'Frozen pizza',               category: 'Фастфуд',    kcal: 266, protein: 11.5, fat: 10.7, carbs: 32.0 },
  { nameRu: 'Блинчики замороженные с мясом',      nameEn: 'Frozen blini with meat',     category: 'Фастфуд',    kcal: 214, protein: 8.5,  fat: 11.0, carbs: 21.0 },
  { nameRu: 'Котлеты замороженные',               nameEn: 'Frozen meat patties',        category: 'Фастфуд',    kcal: 255, protein: 12.0, fat: 18.0, carbs: 9.0 },
  { nameRu: 'Рыбные палочки замороженные',        nameEn: 'Frozen fish sticks',         category: 'Фастфуд',    kcal: 225, protein: 13.0, fat: 9.5,  carbs: 22.0 },
  { nameRu: 'Кукурузные хлопья с сахаром',        nameEn: 'Sweetened corn flakes',      category: 'Фастфуд',    kcal: 383, protein: 5.0,  fat: 1.5,  carbs: 84.0 },
  { nameRu: 'Шоколадные шарики (Nesquik)',         nameEn: 'Chocolate cereal balls',     category: 'Фастфуд',    kcal: 376, protein: 7.0,  fat: 4.5,  carbs: 77.0 },
  { nameRu: 'Роллтон суп куриный (порошок)',       nameEn: 'Instant chicken soup powder', category: 'Фастфуд',  kcal: 371, protein: 8.7,  fat: 15.0, carbs: 51.0 },
]

// ── DataSource ────────────────────────────────────────────────

const AppDataSource = new DataSource({
  type:     'postgres',
  url:       process.env.DATABASE_URL
    ?? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST ?? 'localhost'}:5432/${process.env.DB_NAME}`,
  entities: [Food],
  synchronize: false,
  logging:  false,
})

// ── Seed ──────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize()
  console.log('✅ Connected to database')

  const repo = AppDataSource.getRepository(Food)

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id        SERIAL PRIMARY KEY,
      name_ru   VARCHAR(255) NOT NULL,
      name_en   VARCHAR(255),
      category  VARCHAR(100) NOT NULL,
      kcal      INTEGER      NOT NULL,
      protein   DECIMAL(10,1) NOT NULL,
      fat       DECIMAL(10,1) NOT NULL,
      carbs     DECIMAL(10,1) NOT NULL,
      barcode   VARCHAR(50)
    )
  `)

  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_foods_name_ru   ON foods USING gin(to_tsvector('russian', name_ru))
  `)
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_foods_category  ON foods(category)
  `)

  const existing = await repo.count()
  if (existing > 0) {
    console.log(`⚠️  Таблица содержит ${existing} продуктов. Пропуск.`)
    console.log('   Для пересева: DELETE FROM foods;  — затем запусти снова.')
    await AppDataSource.destroy()
    return
  }

  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < FOODS.length; i += BATCH) {
    await repo.insert(FOODS.slice(i, i + BATCH) as any)
    inserted += Math.min(BATCH, FOODS.length - i)
    process.stdout.write(`\r   Загружено: ${inserted}/${FOODS.length}`)
  }

  const cats = [...new Set(FOODS.map(f => f.category))]
  console.log(`\n✅ Загружено ${inserted} продуктов по ${cats.length} категориям:`)
  console.log('  ', cats.join(', '))
  await AppDataSource.destroy()
}

seed().catch(err => {
  console.error('❌ Ошибка:', err)
  process.exit(1)
})