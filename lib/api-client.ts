// API Client - Fait des appels HTTP vers les API routes côté serveur
// Ce fichier peut être utilisé côté client (navigateur)

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
  location?: string;
  address?: string;
  description?: string;
  is_active: boolean;
  wifi_restricted?: boolean;
  wifi_ssid?: string;
  ip_address?: string;
  created_at: string;
  updated_at?: string;
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

// Builder de requête qui fait des appels API
const createQueryBuilder = (table: string) => {
  let filters: any = {};
  let orderBy: any = undefined;
  let isSingle = false;

  const builder: any = {
    select: (columns?: string) => builder,
    
    eq: (column: string, value: any) => {
      filters[column] = value;
      return builder;
    },
    
    neq: (column: string, value: any) => {
      filters[`${column}_neq`] = value;
      return builder;
    },
    
    gte: (column: string, value: any) => {
      filters[`${column}_gte`] = value;
      return builder;
    },
    
    lte: (column: string, value: any) => {
      filters[`${column}_lte`] = value;
      return builder;
    },
    
    order: (column: string, options?: any) => {
      orderBy = { column, direction: options?.ascending ? 'asc' : 'desc' };
      return builder;
    },
    
    single: () => {
      isSingle = true;
      return builder;
    },
    
    then: async (resolve: any) => {
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            params.append(key, String(value));
          }
        });
        if (orderBy) {
          params.append('orderBy', orderBy.column);
          params.append('orderDir', orderBy.direction);
        }
        if (isSingle) {
          params.append('single', 'true');
        }

        const response = await fetch(`/api/db/${table}?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        resolve(result);
      } catch (error: any) {
        console.error(`Erreur API sur ${table}:`, error);
        resolve({ data: null, error: { message: error.message } });
      }
    },
  };

  return builder;
};

// Client API qui remplace Supabase
export const supabase = {
  from: (table: string) => ({
    select: (columns?: string) => createQueryBuilder(table),
    
    insert: (data: any) => {
      const insertPromise = (async () => {
        try {
          const response = await fetch(`/api/db/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }
          
          const result = await response.json();
          return result;
        } catch (error: any) {
          console.error(`Erreur insert API sur ${table}:`, error);
          return { data: null, error: { message: error.message } };
        }
      })();
      
      return {
        select: () => ({
          then: (resolve: any) => insertPromise.then(resolve),
        }),
        then: (resolve: any) => insertPromise.then(resolve),
      };
    },
    
    update: (data: any) => ({
      eq: async (column: string, value: any) => {
        try {
          const response = await fetch(`/api/db/${table}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, where: { [column]: value } }),
          });
          
          const result = await response.json();
          return result;
        } catch (error: any) {
          console.error(`Erreur update API sur ${table}:`, error);
          return { data: null, error: { message: error.message } };
        }
      },
    }),
    
    delete: () => ({
      eq: async (column: string, value: any) => {
        try {
          const response = await fetch(`/api/db/${table}?${column}=${value}`, {
            method: 'DELETE',
          });
          
          const result = await response.json();
          return result;
        } catch (error: any) {
          console.error(`Erreur delete API sur ${table}:`, error);
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
