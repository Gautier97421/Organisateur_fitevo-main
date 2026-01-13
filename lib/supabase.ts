// Wrapper Supabase -> Prisma : Sauvegarde dans la vraie base de données
import { prisma } from './prisma'

// Types exportés pour compatibilité
export interface Employee {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  remote_work_enabled?: boolean;
  created_at: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_super_admin?: boolean;
  created_at: string;
}

export interface Gym {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
}

// Mapping des tables Supabase vers Prisma
const tableMapping: { [key: string]: any } = {
  calendar_events: 'calendarEvent',
  event_reminders: 'eventReminder',
  gyms: 'gym',
  tasks: 'task',
  work_schedules: 'workSchedule',
  allowed_networks: 'allowedNetwork',
  admins: 'user', // Les admins sont stockés dans users avec role='admin'
  employees: 'user', // Les employés sont stockés dans users avec role='employee'
};

// Builder de requête qui sauvegarde dans Prisma
const createQueryBuilder = (table: string) => {
  let filters: any[] = [];
  let orderBy: any = undefined;
  let isSingle = false;
  const prismaModel = tableMapping[table] || table;

  const builder: any = {
    select: (columns?: string) => builder,
    
    eq: (column: string, value: any) => {
      filters.push({ [column]: value });
      return builder;
    },
    
    neq: (column: string, value: any) => {
      filters.push({ [column]: { not: value } });
      return builder;
    },
    
    gte: (column: string, value: any) => {
      filters.push({ [column]: { gte: value } });
      return builder;
    },
    
    lte: (column: string, value: any) => {
      filters.push({ [column]: { lte: value } });
      return builder;
    },
    
    order: (column: string, options?: any) => {
      orderBy = { [column]: options?.ascending ? 'asc' : 'desc' };
      return builder;
    },
    
    single: () => {
      isSingle = true;
      return builder;
    },
    
    then: async (resolve: any) => {
      try {
        // Construire le where de Prisma
        const where = filters.length > 0 
          ? filters.length === 1 
            ? filters[0] 
            : { AND: filters }
          : {};

        // Exécuter la requête Prisma
        if (isSingle) {
          const data = await (prisma as any)[prismaModel].findFirst({ where, orderBy });
          resolve({ 
            data, 
            error: !data ? { code: 'PGRST116' } : null 
          });
        } else {
          const data = await (prisma as any)[prismaModel].findMany({ where, orderBy });
          resolve({ data, error: null });
        }
      } catch (error: any) {
        console.error(`Erreur Prisma sur ${table}:`, error);
        resolve({ data: null, error: { message: error.message } });
      }
    },
  };

  return builder;
};

// Mock de l'objet Supabase qui utilise Prisma
export const supabase = {
  from: (table: string) => ({
    select: (columns?: string) => createQueryBuilder(table),
    
    insert: (data: any) => {
      const insertPromise = (async () => {
        try {
          const prismaModel = tableMapping[table] || table;
          const items = Array.isArray(data) ? data : [data];
          
          // Convertir les noms de colonnes snake_case vers camelCase pour Prisma
          const convertedItems = await Promise.all(items.map(async (item: any) => {
            const converted: any = {};
            for (const [key, value] of Object.entries(item)) {
              const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              converted[camelKey] = value;
            }
            // Ajouter userId si nécessaire
            if (!converted.userId && table === 'calendar_events') {
              // Récupérer l'userId depuis l'email
              const user = await prisma.user.findUnique({ where: { email: converted.createdByEmail } });
              if (user) converted.userId = user.id;
            }
            if (!converted.userId && (table === 'tasks' || table === 'work_schedules')) {
              // Utiliser le premier admin disponible
              const user = await prisma.user.findFirst({ where: { role: 'admin' } });
              if (user) converted.userId = user.id;
            }
            return converted;
          }));

          // Insérer dans Prisma
          const results = [];
          for (const item of convertedItems) {
            const result = await (prisma as any)[prismaModel].create({ data: item });
            results.push(result);
          }

          return { data: results, error: null };
        } catch (error: any) {
          console.error(`Erreur insert Prisma sur ${table}:`, error);
          return { data: null, error: { message: error.message } };
        }
      })();

      return {
        select: () => insertPromise,
        then: (resolve: any) => insertPromise.then(resolve),
      };
    },
    
    update: (data: any) => ({
      eq: async (column: string, value: any) => {
        try {
          const prismaModel = tableMapping[table] || table;
          
          // Convertir les noms de colonnes
          const converted: any = {};
          for (const [key, val] of Object.entries(data)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            converted[camelKey] = val;
          }

          const result = await (prisma as any)[prismaModel].updateMany({
            where: { [column]: value },
            data: converted,
          });

          return { data: result, error: null };
        } catch (error: any) {
          console.error(`Erreur update Prisma sur ${table}:`, error);
          return { data: null, error: { message: error.message } };
        }
      },
    }),
    
    delete: () => ({
      eq: async (column: string, value: any) => {
        try {
          const prismaModel = tableMapping[table] || table;
          const result = await (prisma as any)[prismaModel].deleteMany({
            where: { [column]: value },
          });
          return { data: result, error: null };
        } catch (error: any) {
          console.error(`Erreur delete Prisma sur ${table}:`, error);
          return { data: null, error: { message: error.message } };
        }
      },
    }),
  }),
  
  auth: {
    signInWithPassword: (credentials: any) =>
      Promise.resolve({
        data: {
          user: { id: '1', email: credentials.email || 'admin@fitevo.com' },
          session: { access_token: 'mock-token' },
        },
        error: null,
      }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () =>
      Promise.resolve({
        data: {
          session: {
            user: { id: '1', email: 'admin@fitevo.com' },
            access_token: 'mock-token',
          },
        },
        error: null,
      }),
    getUser: () =>
      Promise.resolve({
        data: { user: { id: '1', email: 'admin@fitevo.com' } },
        error: null,
      }),
  },
};
