export default function Privacy() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="app-card"
        style={{
          width: "100%",
          maxWidth: 900,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Política de Privacidade</h1>

        <p className="app-muted" style={{ marginTop: 0 }}>
          Última atualização: 16 de março de 2026
        </p>

        <p>
          O aplicativo <strong>Gastos</strong> foi desenvolvido para ajudar usuários a
          gerenciar suas finanças pessoais de forma simples, segura e organizada.
        </p>

        <section style={{ marginTop: 24 }}>
          <h2>1. Informações coletadas</h2>
          <p>O aplicativo pode coletar as seguintes informações:</p>
          <ul>
            <li>endereço de e-mail para autenticação e acesso à conta;</li>
            <li>
              dados financeiros inseridos pelo próprio usuário, como receitas,
              despesas, categorias, orçamentos e recorrências;
            </li>
            <li>
              informações técnicas básicas necessárias para funcionamento do
              aplicativo.
            </li>
          </ul>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>2. Uso das informações</h2>
          <p>As informações coletadas são utilizadas exclusivamente para:</p>
          <ul>
            <li>autenticação do usuário;</li>
            <li>armazenamento e organização dos dados financeiros pessoais;</li>
            <li>funcionamento correto do aplicativo e seus recursos.</li>
          </ul>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>3. Armazenamento dos dados</h2>
          <p>
            Os dados são armazenados de forma segura utilizando serviços em nuvem
            fornecidos pelo <strong>Supabase</strong>.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>4. Compartilhamento de dados</h2>
          <p>
            Nenhuma informação pessoal é vendida, alugada ou compartilhada com
            terceiros para fins comerciais.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>5. Segurança</h2>
          <p>
            São aplicadas medidas técnicas e organizacionais para proteger os dados
            do usuário contra acesso não autorizado, perda, alteração ou divulgação
            indevida.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>6. Controle do usuário</h2>
          <p>O usuário pode, a qualquer momento:</p>
          <ul>
            <li>editar os dados cadastrados;</li>
            <li>remover informações inseridas no aplicativo;</li>
            <li>solicitar exclusão de conta e dados, quando aplicável.</li>
          </ul>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>7. Contato</h2>
          <p>
            Para dúvidas, solicitações ou assuntos relacionados à privacidade,
            entre em contato pelo e-mail:
          </p>
          <p>
            <strong>dhiow04@gmail.com</strong>
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>8. Alterações nesta política</h2>
          <p>
            Esta Política de Privacidade pode ser atualizada periodicamente para
            refletir melhorias no aplicativo ou adequações legais. Recomendamos
            consulta regular desta página.
          </p>
        </section>
      </div>
    </div>
  );
}