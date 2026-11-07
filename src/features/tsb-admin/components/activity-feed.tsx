import {
  ArrowRightLeft,
  CheckCircle2,
  LogIn,
  PlusCircle,
  TriangleAlert,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { activity } from '../data'

const meta = {
  checkin: {
    icon: LogIn,
    className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  assign: {
    icon: ArrowRightLeft,
    className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  },
  late: {
    icon: TriangleAlert,
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  },
  done: {
    icon: CheckCircle2,
    className:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  walkin: {
    icon: PlusCircle,
    className: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  },
}

export function ActivityFeed() {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
        <CardDescription>Log gerbang, dock, dan override admin</CardDescription>
      </CardHeader>
      <CardContent className='px-0'>
        <ScrollArea className='h-[290px]'>
          <ol className='space-y-0'>
            {activity.map((item, index) => {
              const { icon: Icon, className } = meta[item.kind]
              return (
                <li key={item.title} className='relative flex gap-3 px-6 pb-4'>
                  {index < activity.length - 1 ? (
                    <span className='absolute start-[38px] top-9 h-full w-px bg-border' />
                  ) : null}
                  <span
                    className={cn(
                      'z-10 flex size-7 shrink-0 items-center justify-center rounded-full',
                      className
                    )}
                  >
                    <Icon className='size-3.5' />
                  </span>
                  <div className='min-w-0 space-y-0.5'>
                    <p className='text-sm leading-snug font-medium'>{item.title}</p>
                    <p className='text-xs text-muted-foreground'>{item.detail}</p>
                    <p className='text-[11px] text-muted-foreground/80'>{item.time}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
