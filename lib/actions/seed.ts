'use server'

import { createClient } from '@/utils/supabase/server'

const SEED_ACCOUNTS = [
  { name: 'Checking', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'Cash', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'Credit Card', account_type: 'CREDIT', currency: 'CRC' },
] as const

const SEED_CATEGORY_GROUPS: Array<{
  name: string
  kind: 'EXPENSE' | 'INCOME'
  children: string[]
}> = [
  {
    name: 'Immediate Obligations',
    kind: 'EXPENSE',
    children: ['Rent/Mortgage', 'Electric', 'Water', 'Internet', 'Phone', 'Groceries'],
  },
  {
    name: 'True Expenses',
    kind: 'EXPENSE',
    children: [
      'Auto Maintenance',
      'Home Maintenance',
      'Medical',
      'Clothing',
      'Gifts',
      'Annual Subscriptions',
      'Insurance',
    ],
  },
  {
    name: 'Debt Payments',
    kind: 'EXPENSE',
    children: ['Credit Card Payment', 'Student Loan', 'Car Payment'],
  },
  {
    name: 'Quality of Life',
    kind: 'EXPENSE',
    children: [
      'Dining Out',
      'Entertainment',
      'Education',
      'Fitness',
      'Personal Care',
      'Subscriptions',
    ],
  },
  {
    name: 'Savings Goals',
    kind: 'EXPENSE',
    children: ['Emergency Fund', 'Vacation', 'New Car', 'Down Payment'],
  },
  {
    name: 'Income',
    kind: 'INCOME',
    children: ['Salary', 'Freelance', 'Investments', 'Other Income'],
  },
]

export async function ensureUserSeed(userId: string) {
  const supabase = await createClient()

  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('user_id', userId)

  const existingNames = new Set((existingAccounts ?? []).map((a: any) => a.name))

  for (const acc of SEED_ACCOUNTS) {
    if (existingNames.has(acc.name)) continue
    await supabase.from('accounts').insert({
      user_id: userId,
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      is_active: true,
    })
  }

  const { data: existingCats } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id')
    .eq('user_id', userId)

  const existingL1 = (existingCats ?? []).filter((c: any) => c.level === 1)
  const existingL1Names = new Set(existingL1.map((c: any) => c.name))

  for (const group of SEED_CATEGORY_GROUPS) {
    let parentId: string | null = null

    if (!existingL1Names.has(group.name)) {
      const { data: inserted } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: group.name,
          level: 1,
          parent_category_id: null,
          category_kind: group.kind,
        })
        .select('id')
        .single()
      parentId = inserted?.id ?? null
    } else {
      const found = existingL1.find((c: any) => c.name === group.name)
      parentId = found?.id ?? null
    }

    if (parentId && group.children.length) {
      const existingChildNames = new Set(
        (existingCats ?? [])
          .filter((c: any) => c.level === 2 && c.parent_category_id === parentId)
          .map((c: any) => c.name)
      )
      for (const childName of group.children) {
        if (existingChildNames.has(childName)) continue
        await supabase.from('categories').insert({
          user_id: userId,
          name: childName,
          level: 2,
          parent_category_id: parentId,
          category_kind: group.kind,
        })
      }
    }
  }

  return { ok: true }
}
