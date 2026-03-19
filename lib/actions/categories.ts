'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { success: false; error: string }

export async function createCategoryGroup(name: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name,
      level: 1,
      parent_category_id: null,
      category_kind: 'EXPENSE',
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/budget')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function createCategory(params: {
  name: string
  parentId: string
  kind?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: params.name,
      level: 2,
      parent_category_id: params.parentId,
      category_kind: params.kind || 'EXPENSE',
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/budget')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/budget')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function getAllCategories(userId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id, category_kind')
    .eq('user_id', userId)
    .order('name')

  return data ?? []
}
