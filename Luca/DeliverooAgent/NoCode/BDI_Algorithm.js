define BDI_control_loop(Intentions_0, Beliefs_0){
    B = Beliefs_0
    I = Intentions_0

    while (true){
        
        // Rilevazione dell'ambiente
        p = get_percept()

        B = belief_set_revision(B, p)

        D = generate_options(B, I)

        I = filter_desires(B, D, I)

        P = generate_plan(B,I)

        while ( !P.isEmpty() || succeeded(I, B) || impossible(I, B)){

            action = P.pop()
            execute_action(action)

            P = get_percept()

            B = belief_set_revision(B, p)

            if (reconsider(I, B)){ 

                D = generate_options(B, I)

                I = filter_desires(B, D, I)
            }

            if (failed_plan(P, I, B)){

                P = generate_plan(B, I)
            }
        }
    }
}