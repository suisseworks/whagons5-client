describe('Login and collasible sidebar test', () => {
  it('passes', () => {
    cy.visit('http://localhost:5173/auth/signin')
    
    // Decide based on current route: if still on /auth/signin → login, else proceed
    cy.wait(3000)
    cy.location('pathname', { timeout: 20000 }).then((pathname) => {
      if (pathname.includes('/auth/signin')) {
        // Not logged in yet → perform login
        cy.get('input[type="email"]', { timeout: 20000 }).should('be.visible')
        cy.get('input[type="password"]', { timeout: 20000 }).should('be.visible')
        cy.get('[cypress-id="signin-button"]', { timeout: 20000 }).should('be.visible')

        cy.get('input[type="email"]').type('test@test.com')
        cy.get('input[type="password"]').type('Tomates05')
        cy.get('[cypress-id="signin-button"]').click()

        cy.get('[cypress-id="get-started-button"]', { timeout: 20000 }).should('be.visible').click()
      } else {
        // Already logged in → proceed directly
        cy.get('[cypress-id="get-started-button"]', { timeout: 20000 }).should('be.visible').click()

        cy.get('[cypress-id="workspace-sidebar-trigger"]').should('exist')
        cy.get('[cypress-id="workspace-sidebar-trigger"]').click()

      }
    })

  })
})