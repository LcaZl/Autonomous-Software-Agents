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
    )
)
