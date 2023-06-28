(define (problem deliveroo-reach-parcel)
    (:domain deliveroo)
    (:objects
        t1 - tile
        t2 - tile
        t3 - tile
        t4 - tile
        t5 - tile
        t6 - tile
        t7 - tile
        t8 - tile
        t9 - tile
        t10 - tile
        t11 - tile
        t12 - tile
        t13 - tile
        t14 - tile
        t15 - tile
        t16 - tile
        a1 - agent
        p - parcel
    )
    (:init
        (me a1)
        (tile t1)
        (tile t2)

        (right t2 t1)
        (right t3 t2)
        (right t4 t3)
        (right t6 t5)
        (right t7 t6)
        (right t8 t7)
        (right t10 t9)
        (right t11 t10)
        (right t12 t11)

        (left t1 t2)
        (left t2 t3)
        (left t3 t4)
        (left t5 t6)
        (left t6 t7)
        (left t7 t8)
        (left t9 t10)
        (left t10 t11)
        (left t11 t12)

        (down t5 t1)
        (down t6 t2)
        (down t7 t3)
        (down t8 t4)
        (down t9 t5)
        (down t10 t6)
        (down t11 t7)
        (down t12 t8)

        (up t1 t5)
        (up t2 t6)
        (up t3 t7)
        (up t4 t8)
        (up t5 t9)
        (up t6 t10)
        (up t7 t11)
        (up t8 t12)

        (at a1 t12)
        (parcel p)
        (at p t7)
        (delivery t1)
    )
    (:goal
        (at a1 t7)
    )
)
