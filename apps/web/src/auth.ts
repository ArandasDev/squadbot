import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

/**
 * Autenticacao do dashboard: login com a propria conta do Discord.
 *
 * Escopos pedidos:
 *  - `identify` para saber quem é a pessoa (id, nome, avatar);
 *  - `guilds` nao é necessario aqui — quem decide em quais servidores a pessoa
 *    entra é a API do bot, que verifica a associacao na guild de verdade.
 *    Confiar na lista vinda do OAuth seria confiar no cliente.
 *
 * Sessao em JWT: o dashboard nao tem banco proprio, toda a persistencia vive
 * no SQLite do bot.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      authorization: 'https://discord.com/oauth2/authorize?scope=identify',
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/entrar', error: '/entrar' },
  callbacks: {
    jwt({ token, profile }) {
      // `profile` so vem no login; nas renovacoes o valor ja esta no token.
      if (profile?.id) token.discordId = String(profile.id);
      return token;
    },
    session({ session, token }) {
      if (token.discordId) session.user.discordId = token.discordId;
      return session;
    },
  },
});
