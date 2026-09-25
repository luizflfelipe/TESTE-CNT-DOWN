const fs = require('fs');
let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

const target = `          <Card className="border-red-500/20 bg-red-500/10">
            <CardContent className="py-8 text-sm font-bold text-red-300">
              Seu usuário não possui acesso à área Motoboy.
            </CardContent>
          </Card>
        )}
      </motion.div>`;

const replacement = `          <Card className="border-red-500/20 bg-red-500/10">
            <CardContent className="py-8 text-sm font-bold text-red-300">
              Seu usuário não possui acesso à área Motoboy.
            </CardContent>
          </Card>
        )}
          </div>
      </motion.div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Motoboy.tsx', code);
