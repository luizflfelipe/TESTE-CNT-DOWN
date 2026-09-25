const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Fix 1: .insert({ request_id: ... })
code = code.replace(
  /await supabase\.from\("motoboy_request_events"\)\.insert\(\{([\s\S]*?)\}\);/g,
  'await supabase.from("motoboy_request_events").insert({$1} as any);'
);

// Fix 2: inserted!
code = code.replace(
  /const \{ data: inserted, error \} = await supabase\.from\("motoboy_requests"\)\.insert\(snakeData\)\.select\(\)\.single\(\);/g,
  `const { data: inserted, error } = await supabase.from("motoboy_requests").insert(snakeData as any).select().single();
        if (!inserted) throw new Error("Failed to insert record.");`
);

// Fix 3: updated! (PATCH)
code = code.replace(
  /const \{ data: updated, error \} = await supabase\.from\("motoboy_requests"\)\.update\(snakeData\)\.eq\("id", id\)\.select\(\)\.single\(\);/g,
  `const { data: updated, error } = await supabase.from("motoboy_requests").update(snakeData as any).eq("id", id).select().single();
        if (!updated) throw new Error("Failed to update record.");`
);

// Fix 4: updated! (DELETE)
code = code.replace(
  /const \{ data: updated, error \} = await supabase\.from\("motoboy_requests"\)\.update\(updateData\)\.eq\("id", id\)\.select\(\)\.single\(\);/g,
  `const { data: updated, error } = await supabase.from("motoboy_requests").update(updateData as any).eq("id", id).select().single();
        if (!updated) throw new Error("Failed to delete record.");`
);

fs.writeFileSync('server.ts', code);
