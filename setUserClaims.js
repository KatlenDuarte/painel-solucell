// CommonJS
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json') // JSON carregado normalmente

// Inicializa o Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// Exemplo: define claims para um usuário
const uid = 'IrwZAjXXwdTLDjRhjFWWSxy5ZO73' // substitua pelo UID real
admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Claims definidas para o usuário ${uid}`)
    process.exit(0)
  })
  .catch(error => {
    console.error('Erro ao definir claims:', error)
    process.exit(1)
  })
