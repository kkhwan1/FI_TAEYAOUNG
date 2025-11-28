import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client with service role key for server-side operations
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Admin helper functions for server-side operations
export const supabaseAdminHelpers = {
  // User management (admin only)
  users: {
    createUser: async (userData: {
      email: string
      password: string
      name: string
      username: string
      department?: string
      role?: 'admin' | 'manager' | 'operator' | 'viewer'
    }) => {
      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      })

      if (authError || !authUser.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`)
      }

      // Create user record in database
      const { data: dbUser, error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          username: userData.username,
          password_hash: 'managed_by_auth', // Placeholder since we use Supabase Auth
          name: userData.name,
          email: userData.email ?? null,
          department: userData.department ?? null,
          role: userData.role ?? 'operator',
          is_active: true
        } as any)
        .select()
        .single()

      if (dbError) {
        // Cleanup auth user if database insert fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        throw new Error(`Failed to create database user: ${dbError.message}`)
      }

      return { authUser, dbUser }
    },

    updateUser: async (id: number, updates: {
      name?: string
      email?: string
      department?: string
      role?: 'admin' | 'manager' | 'operator' | 'viewer'
      is_active?: boolean
    }) => {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update user: ${error.message}`)
      }

      return data
    },

    deleteUser: async (id: number) => {
      // Get user email for auth deletion
      const { data: user, error: getUserError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', id)
        .single()

      if (getUserError || !user?.email) {
        throw new Error('User not found')
      }

      // Soft delete in database
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .update({ is_active: false })
        .eq('id', id)

      if (dbError) {
        throw new Error(`Failed to deactivate user: ${dbError.message}`)
      }

      // Optionally delete from auth (uncomment if needed)
      // const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      // const authUser = authUsers.users.find(u => u.email === user.email)
      // if (authUser) {
      //   await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      // }

      return true
    },

    getAllUsers: async () => {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`)
      }

      return data
    }
  },

  // Database schema and migration helpers
  schema: {
    // Check if tables exist
    checkTables: async () => {
      try {
        const tables = [
          'users', 'items', 'companies', 'boms',
          'inventory_transactions', 'documents',
          'document_details', 'scraps'
        ]

        const results = []
        for (const table of tables) {
          const { data, error } = await supabaseAdmin
            .from(table as any)
            .select('*', { count: 'exact', head: true })

          results.push({
            table,
            exists: !error,
            error: error?.message
          })
        }

        return results
      } catch (error) {
        throw new Error(`Failed to check tables: ${error}`)
      }
    },

    // Check if views exist
    checkViews: async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from('current_stock_view')
          .select('*', { count: 'exact', head: true } as any)

        return {
          current_stock: {
            exists: !error,
            error: error?.message
          }
        }
      } catch (error) {
        throw new Error(`Failed to check views: ${error}`)
      }
    },

    // Get table statistics
    getTableStats: async () => {
      const tables = [
        'users', 'items', 'companies', 'boms',
        'inventory_transactions', 'documents',
        'document_details', 'scraps'
      ]

      const stats = []
      for (const table of tables) {
        try {
          const { count, error } = await supabaseAdmin
            .from(table as any)
            .select('*', { count: 'exact', head: true })

          stats.push({
            table,
            count: count || 0,
            error: error?.message
          })
        } catch (error) {
          stats.push({
            table,
            count: 0,
            error: `Failed to count: ${error}`
          })
        }
      }

      return stats
    }
  },

  // Data migration helpers
  migration: {
    // Import sample data
    importSampleData: async () => {
      try {
        // Sample users
        const users = [
          {
            username: 'admin',
            password_hash: 'managed_by_auth',
            name: '관리자',
            email: 'admin@taechang.com',
            department: '전산팀',
            role: 'admin' as const
          },
          {
            username: 'manager',
            password_hash: 'managed_by_auth',
            name: '김부장',
            email: 'manager@taechang.com',
            department: '생산관리팀',
            role: 'manager' as const
          },
          {
            username: 'operator1',
            password_hash: 'managed_by_auth',
            name: '이대리',
            email: 'operator1@taechang.com',
            department: '생산팀',
            role: 'operator' as const
          }
        ]

        const { data: insertedUsers, error: usersError } = await supabaseAdmin
          .from('users')
          .insert(users as any)
          .select()

        if (usersError) {
          throw new Error(`Failed to insert users: ${usersError.message}`)
        }

        // Sample items
        const items = [
          {
            item_code: 'MAT-001',
            name: '스틸 플레이트',
            specification: '100x100x10mm',
            category: '원자재' as const,
            unit: 'EA',
            safety_stock: 50,
            lead_time_days: 7,
            unit_price: 15000
          },
          {
            item_code: 'MAT-002',
            name: '알루미늄 프로파일',
            specification: '30x30x1000mm',
            category: '원자재' as const,
            unit: 'EA',
            safety_stock: 20,
            lead_time_days: 5,
            unit_price: 8000
          },
          {
            item_code: 'PRD-001',
            name: 'A형 브라켓',
            specification: '자동차용 브라켓 A타입',
            category: '제품' as const,
            unit: 'EA',
            safety_stock: 10,
            lead_time_days: 0,
            unit_price: 45000
          }
        ]

        const { data: insertedItems, error: itemsError } = await supabaseAdmin
          .from('items')
          .insert(items as any)
          .select()

        if (itemsError) {
          throw new Error(`Failed to insert items: ${itemsError.message}`)
        }

        // Sample companies removed - no hardcoded companies

        return {
          users: insertedUsers,
          items: insertedItems,
          companies: []
        }
      } catch (error) {
        throw new Error(`Failed to import sample data: ${error}`)
      }
    },

    // Clear all data (use with caution)
    clearAllData: async () => {
      try {
        const tables = [
          'scraps', 'document_details', 'documents',
          'inventory_transactions', 'boms',
          'companies', 'items', 'users'
        ]

        const results = []
        for (const table of tables) {
          const { error } = await supabaseAdmin
            .from(table as any)
            .delete()
            .neq('id', 0) // Delete all records

          results.push({
            table,
            success: !error,
            error: error?.message
          })
        }

        return results
      } catch (error) {
        throw new Error(`Failed to clear data: ${error}`)
      }
    }
  },

  // Backup and restore helpers
  backup: {
    // Export table data
    exportTable: async (tableName: string) => {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName as any)
          .select('*')

        if (error) {
          throw new Error(`Failed to export ${tableName}: ${error.message}`)
        }

        return data
      } catch (error) {
        throw new Error(`Failed to export table ${tableName}: ${error}`)
      }
    },

    // Import table data
    importTable: async (tableName: string, data: unknown[]) => {
      try {
        const { error } = await supabaseAdmin
          .from(tableName as any)
          .insert(data)

        if (error) {
          throw new Error(`Failed to import ${tableName}: ${error.message}`)
        }

        return true
      } catch (error) {
        throw new Error(`Failed to import table ${tableName}: ${error}`)
      }
    }
  }
}

export default supabaseAdmin