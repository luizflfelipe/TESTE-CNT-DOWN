const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleEquipamento(equip.id)}
                      >
                        <Checkbox 
                          id={equip.id} 
                          checked={isSelected}
                          onCheckedChange={() => toggleEquipamento(equip.id)}
                          className="border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                        />`;

const replacement = `<div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleEquipamento(equip.id)}
                      >
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <Checkbox 
                            id={equip.id} 
                            checked={isSelected}
                            onCheckedChange={() => toggleEquipamento(equip.id)}
                            className="border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                          />
                        </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
