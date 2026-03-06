// packages/contract/src/contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { SleepSchema }     from './schemas/sleep.schema';
import { MoodSchema }      from './schemas/mood.schema';
import { StressSchema }    from './schemas/stress.schema';
import { ActivitySchema }  from './schemas/activity.schema';
import { WaterSchema }     from './schemas/water.schema';
import { NutritionSchema } from './schemas/nutrition.schema';
import { InsightsSchema, RecommendationSchema } from './schemas/insights.schema';

const c = initContract();

const paginationQuery = z.object({
  limit:  z.coerce.number().default(30),
  offset: z.coerce.number().default(0),
});

const idParam = z.object({ id: z.string().uuid() });

// Loose passthrough — специально для TypeORM entities (у них нет индексной сигнатуры)
const looseObject = z.record(z.unknown());
const listResponse = z.object({
  data:  z.array(looseObject),
  total: z.number(),
});

export const healthContract = c.router({
  sleep: {
    list:   { method: 'GET',    path: '/sleep',     query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/sleep',     body: SleepSchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/sleep/:id', pathParams: idParam, body: SleepSchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/sleep/:id', pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  mood: {
    list:   { method: 'GET',    path: '/mood',      query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/mood',      body: MoodSchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/mood/:id',  pathParams: idParam, body: MoodSchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/mood/:id',  pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  stress: {
    list:   { method: 'GET',    path: '/stress',    query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/stress',    body: StressSchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/stress/:id', pathParams: idParam, body: StressSchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/stress/:id', pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  activity: {
    list:   { method: 'GET',    path: '/activity',  query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/activity',  body: ActivitySchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/activity/:id', pathParams: idParam, body: ActivitySchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/activity/:id', pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  water: {
    list:   { method: 'GET',    path: '/water',     query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/water',     body: WaterSchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/water/:id', pathParams: idParam, body: WaterSchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/water/:id', pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  nutrition: {
    list:   { method: 'GET',    path: '/nutrition', query: paginationQuery, responses: { 200: listResponse } },
    create: { method: 'POST',   path: '/nutrition', body: NutritionSchema.omit({ id: true }), responses: { 201: looseObject } },
    update: { method: 'PATCH',  path: '/nutrition/:id', pathParams: idParam, body: NutritionSchema.partial().omit({ id: true }), responses: { 200: looseObject } },
    delete: { method: 'DELETE', path: '/nutrition/:id', pathParams: idParam, body: c.noBody(), responses: { 204: c.noBody() } },
  },

  insights: c.router({
    me: {
      method: 'GET',
      path: '/insights/me',
      responses: { 200: InsightsSchema },
    },
    recommendations: {
      method: 'GET',
      path: '/insights/recommendations',
      responses: { 
        200: z.object({ 
          data: z.array(RecommendationSchema.extend({ id: z.string() })) 
        }) 
      },
    },
  }),
});

export type HealthContract = typeof healthContract;