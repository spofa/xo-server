export async function addPerformancePlan ({ name, pools }) {
  const plugins = await this.getPlugins()
  const loadBalancer = plugins.find(plugin => plugin.id === 'load-balancer').instance

  loadBalancer._addPlan({
    name,
    mode: 0,
    poolIds: pools.split(',')
  })
}

addPerformancePlan.permission = 'admin'
addPerformancePlan.params = {
  name: { type: 'string' },
  pools: { type: 'string' }
}

export async function addDensityPlan ({ name, pools }) {
  const plugins = await this.getPlugins()
  const loadBalancer = plugins.find(plugin => plugin.id === 'load-balancer').instance

  loadBalancer._addPlan({
    name,
    mode: 1,
    poolIds: pools.split(',')
  })
}

addDensityPlan.permission = 'admin'
addDensityPlan.params = {
  name: { type: 'string' },
  pools: { type: 'string' }
}
