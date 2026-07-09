'use client'
import { useState } from 'react'

interface FeedbackFormProps {
  internshipId: string
  existingFeedback?: {
    student_rating: number | null
    student_comments: string | null
  }
}

export default function FeedbackForm({ internshipId, existingFeedback }: FeedbackFormProps) {
  const [rating, setRating] = useState<number>(existingFeedback?.student_rating || 0)
  const [comments, setComments] = useState<string>(existingFeedback?.student_comments || '')
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(!!existingFeedback?.student_rating)
  const [error, setError] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setError('Please select a rating of 1 to 5 stars.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internship_id: internshipId,
          rating,
          comments
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback')
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
          ✓
        </div>
        <h2 className="text-lg font-bold text-gray-900">Feedback Submitted</h2>
        <p className="text-sm text-gray-500">
          Thank you for providing your feedback. Your input helps us improve the MCL Internship Program.
        </p>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-2xl ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
            >
              ★
            </span>
          ))}
        </div>
        {comments && (
          <p className="text-xs bg-gray-50 p-3 rounded-xl text-gray-600 italic max-w-md mx-auto">
            "{comments}"
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Rate Your Internship Experience</h2>
        <p className="text-xs text-gray-500">Please provide your honest rating of the program, facilities, and overall learning environment.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Rating</label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="text-3xl focus:outline-none transition-colors"
            >
              <span
                className={
                  star <= (hoverRating || rating)
                    ? 'text-amber-400 scale-110'
                    : 'text-gray-200'
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Your Comments / Suggestions</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          placeholder="Share your thoughts on what went well, what could be improved, or any special experience during training..."
          className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-[#166534] hover:bg-[#155e2f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  )
}
