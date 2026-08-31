/**
 * Banco usado pelos testes de integração de `apps/api`.
 *
 * A suíte apaga linhas (`deleteMany`) entre testes, então o destino não pode
 * depender de um `DATABASE_URL` herdado do ambiente: uma variável de outro
 * projeto na mesma máquina levaria os testes a migrar e limpar um banco
 * alheio. O destino é sempre este, sobreponível apenas de forma explícita por
 * `TEST_DATABASE_URL`.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/lista_ofertas_test";
