describe('Task Creation Test', () => {
  it('should create a task', () => {
    cy.visit('http://localhost:5173/auth/signin')
    
    // Login if needed
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
      }
    })

    // Wait for welcome page to load after clicking get started
    // Verify we're on the welcome page
    cy.location('pathname', { timeout: 20000 }).should('include', '/welcome')
    // Wait a bit more for page to fully render
    cy.wait(3000)
    
    // Try to find and click create task button
    // This could be a button with text "Create Task", "New Task", "+", or a specific cypress-id
    cy.get('body').then(($body) => {
      // Try multiple possible selectors for create task button
      if ($body.find('[cypress-id="create-task-button"]').length > 0) {
        cy.get('[cypress-id="create-task-button"]').click()
      } else if ($body.find('button:contains("Create Task")').length > 0) {
        cy.get('button:contains("Create Task")').click()
      } else if ($body.find('button:contains("New Task")').length > 0) {
        cy.get('button:contains("New Task")').click()
      } else if ($body.find('[aria-label*="task" i], [aria-label*="create" i]').length > 0) {
        cy.get('[aria-label*="task" i], [aria-label*="create" i]').first().click()
      } else {
        // Fallback: look for any button with + icon or "Add" text
        cy.get('button').contains(/\+|Add|New/i).first().click()
      }
    })

    // Wait for task creation form/modal to appear
    cy.wait(1000)

    // Fill in task form fields
    // Try to find task title/name field
    cy.get('body').then(($body) => {
      if ($body.find('input[placeholder*="title" i], input[placeholder*="name" i]').length > 0) {
        cy.get('input[placeholder*="title" i], input[placeholder*="name" i]').first().type('Test Task Created by Cypress')
      } else if ($body.find('input[type="text"]').length > 0) {
        cy.get('input[type="text"]').first().type('Test Task Created by Cypress')
      } else if ($body.find('textarea').length > 0) {
        cy.get('textarea').first().type('Test Task Created by Cypress')
      }
    })

    // Try to submit/create the task
    cy.get('body').then(($body) => {
      if ($body.find('[cypress-id="submit-task-button"], [cypress-id="create-task-submit"]').length > 0) {
        cy.get('[cypress-id="submit-task-button"], [cypress-id="create-task-submit"]').first().click()
      } else if ($body.find('button[type="submit"]').length > 0) {
        cy.get('button[type="submit"]').first().click()
      } else if ($body.find('button:contains("Create")').length > 0) {
        cy.get('button:contains("Create")').first().click()
      } else if ($body.find('button:contains("Save")').length > 0) {
        cy.get('button:contains("Save")').first().click()
      }
    })

    // Verify task was created (check for success message or task appearing in list)
    cy.wait(2000)
    // Check if task appears in the list or success message appears
    cy.get('body').then(($body) => {
      const hasTask = $body.text().includes('Test Task Created by Cypress')
      const hasSuccess = $body.text().match(/created|success/i)
      expect(hasTask || hasSuccess).to.be.true
    })
  })
})
