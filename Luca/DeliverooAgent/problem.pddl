(define (problem simple-deliveroo-problem)
    (:domain deliveroo)
    (:objects
        t11 t12 
        t21 t22 
        agent1 - agent
        parcel1 - parcel
    )
    (:init
        (agent agent1)
        (me agent1)
        (parcel parcel1)
        (at agent1 t11)
        (at parcel1 t12)
        (delivery t22)
        (right t11 t12) (left t12 t11)
        (right t21 t22) (left t22 t21)
        (up t11 t21) (down t21 t11)
        (up t12 t22) (down t22 t12)
    )
    (:goal
        (and
            (not (carries agent1 parcel1))
            (at agent1 t22)
        )
    )
)
