module.exports = {
  apps : [{
    name   : "gamezone-backend",
    script : "./dist/src/index.js",
    env_production: {
       NODE_ENV: "production"
    }
  }]
}