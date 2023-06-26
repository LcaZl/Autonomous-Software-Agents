(define (problem deliveroo-reach-parcel)
    (:domain deliveroo)
    (:objects 
        t1 - tile
        t2 - tile
        a1 - agent
        p - parcel
    )
    (:init
        (me a1)
        (tile t1)
        (tile t2)
        (at a1 t1)
        (parcel p)
        (at p t2)
    )
    (:goal 
        (at a1 t2)

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
